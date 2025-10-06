/**
 * Lazy Loader - Background Data Loading
 * Phase 2: Non-blocking data retrieval with timeout-based fallback
 * 
 * Allows expensive operations (RAG, memory, history) to load in background
 * while main request proceeds with fallback values
 */

import { logInfo, logError } from './logger-utils.ts';

export class LazyLoader<T> {
  private promise: Promise<T> | null = null;
  private result: T | null = null;
  private error: Error | null = null;
  private startTime: number = 0;
  private loaderName: string;
  
  constructor(
    private loader: () => Promise<T>,
    name: string = 'unnamed-loader'
  ) {
    this.loaderName = name;
  }
  
  /**
   * Start loading in background immediately
   */
  start(): void {
    if (this.promise) {
      return; // Already started
    }

    this.startTime = Date.now();
    logInfo('lazy-loader', `Starting ${this.loaderName}`);
    
    this.promise = this.loader()
      .then(result => {
        const duration = Date.now() - this.startTime;
        this.result = result;
        logInfo('lazy-loader', `${this.loaderName} completed`, { durationMs: duration });
        return result;
      })
      .catch(error => {
        const duration = Date.now() - this.startTime;
        this.error = error;
        logError('lazy-loader', `${this.loaderName} failed`, error as Error, { durationMs: duration });
        throw error;
      });
  }
  
  /**
   * Get result if ready within timeout, otherwise return null
   * This is the key optimization - don't wait if data isn't ready yet
   */
  async getIfReady(timeoutMs: number = 100): Promise<T | null> {
    // Already resolved
    if (this.result) {
      logInfo('lazy-loader', `${this.loaderName} - using cached result`);
      return this.result;
    }
    
    // Already failed
    if (this.error) {
      logError('lazy-loader', `${this.loaderName} - returning null due to previous error`, this.error);
      return null;
    }
    
    // Not started yet
    if (!this.promise) {
      logInfo('lazy-loader', `${this.loaderName} - not started, returning null`);
      return null;
    }
    
    // Race between promise and timeout
    const timeout = new Promise<null>(resolve => 
      setTimeout(() => {
        logInfo('lazy-loader', `${this.loaderName} - timeout exceeded (${timeoutMs}ms), returning null`);
        resolve(null);
      }, timeoutMs)
    );
    
    try {
      return await Promise.race([this.promise, timeout]);
    } catch {
      return null;
    }
  }
  
  /**
   * Get result (wait indefinitely if needed)
   * Use this only when you absolutely need the data
   */
  async get(): Promise<T> {
    if (this.result) {
      return this.result;
    }
    
    if (this.error) {
      throw this.error;
    }
    
    if (!this.promise) {
      this.start();
    }
    
    return this.promise!;
  }

  /**
   * Check if loader has completed (success or failure)
   */
  isComplete(): boolean {
    return this.result !== null || this.error !== null;
  }

  /**
   * Check if loader is still running
   */
  isRunning(): boolean {
    return this.promise !== null && !this.isComplete();
  }
}

/**
 * Helper to create multiple loaders and start them all in parallel
 */
export function createAndStartLoaders<T extends Record<string, LazyLoader<any>>>(
  loaders: T
): T {
  Object.values(loaders).forEach(loader => loader.start());
  return loaders;
}
