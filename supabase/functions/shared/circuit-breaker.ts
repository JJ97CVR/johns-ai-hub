// Circuit Breaker Pattern for API calls
// Prevents cascading failures by temporarily blocking failing services

interface CircuitState {
  failures: number;
  lastFailure: number;
  lastSuccess: number;
}

export class CircuitBreaker {
  private states = new Map<string, CircuitState>();
  private readonly failureThreshold: number;
  private readonly timeout: number;
  private readonly halfOpenAttempts: number;

  constructor(
    failureThreshold: number = 5,
    timeout: number = 60000, // 1 minute
    halfOpenAttempts: number = 1
  ) {
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
    this.halfOpenAttempts = halfOpenAttempts;
  }

  /**
   * Check if circuit breaker is open (blocking requests)
   */
  isOpen(serviceId: string): boolean {
    const state = this.states.get(serviceId);
    if (!state) return false;

    const now = Date.now();

    // If timeout has passed, allow half-open state (try again)
    if (now - state.lastFailure > this.timeout) {
      return false;
    }

    // Circuit is open if we've exceeded failure threshold
    return state.failures >= this.failureThreshold;
  }

  /**
   * Get circuit state for monitoring
   */
  getState(serviceId: string): 'closed' | 'open' | 'half-open' {
    const state = this.states.get(serviceId);
    if (!state) return 'closed';

    const now = Date.now();
    
    if (state.failures >= this.failureThreshold) {
      if (now - state.lastFailure > this.timeout) {
        return 'half-open';
      }
      return 'open';
    }

    return 'closed';
  }

  /**
   * Record a successful call
   */
  recordSuccess(serviceId: string): void {
    const state = this.states.get(serviceId);
    if (state) {
      // Reset failures on success
      state.failures = 0;
      state.lastSuccess = Date.now();
      this.states.set(serviceId, state);
    } else {
      this.states.set(serviceId, {
        failures: 0,
        lastSuccess: Date.now(),
        lastFailure: 0
      });
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(serviceId: string): void {
    const now = Date.now();
    const state = this.states.get(serviceId) || {
      failures: 0,
      lastSuccess: 0,
      lastFailure: 0
    };

    state.failures++;
    state.lastFailure = now;
    this.states.set(serviceId, state);

    if (state.failures >= this.failureThreshold) {
      console.warn(`Circuit breaker OPENED for ${serviceId} after ${state.failures} failures`);
    }
  }

  /**
   * Get failure count for a service
   */
  getFailureCount(serviceId: string): number {
    return this.states.get(serviceId)?.failures || 0;
  }

  /**
   * Manually reset circuit breaker for a service
   */
  reset(serviceId: string): void {
    this.states.delete(serviceId);
  }

  /**
   * Get all circuit states for monitoring
   */
  getAllStates(): Record<string, { state: string; failures: number }> {
    const result: Record<string, { state: string; failures: number }> = {};
    
    for (const [serviceId, state] of this.states.entries()) {
      result[serviceId] = {
        state: this.getState(serviceId),
        failures: state.failures
      };
    }

    return result;
  }
}

// Global circuit breaker instance
export const globalCircuitBreaker = new CircuitBreaker();
