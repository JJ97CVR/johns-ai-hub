/**
 * Logger Utilities
 * Sprint 6: Code Cleanup - Centralized logging helpers
 * 
 * Helper functions for replacing console.log with structured logging
 */

import { createLogger, StructuredLogger } from './structured-logger.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Global logger registry to avoid creating multiple loggers
 */
const loggerRegistry = new Map<string, StructuredLogger>();

/**
 * Get or create a logger for a specific function/module
 */
export function getLogger(
  functionName: string, 
  supabase?: SupabaseClient
): StructuredLogger {
  const key = `${functionName}`;
  
  if (!loggerRegistry.has(key)) {
    const logger = createLogger(functionName, supabase);
    loggerRegistry.set(key, logger);
  }
  
  return loggerRegistry.get(key)!;
}

/**
 * Replace console.log with structured logging
 * Use this helper for quick migration
 */
export function logInfo(
  functionName: string,
  message: string,
  metadata?: Record<string, unknown>,
  supabase?: SupabaseClient
): void {
  const logger = getLogger(functionName, supabase);
  logger.info(message, { metadata });
}

/**
 * Replace console.warn with structured logging
 */
export function logWarn(
  functionName: string,
  message: string,
  metadata?: Record<string, unknown>,
  supabase?: SupabaseClient
): void {
  const logger = getLogger(functionName, supabase);
  logger.warn(message, { metadata });
}

/**
 * Replace console.error with structured logging
 */
export function logError(
  functionName: string,
  message: string,
  error?: Error,
  metadata?: Record<string, unknown>,
  supabase?: SupabaseClient
): void {
  const logger = getLogger(functionName, supabase);
  logger.error(message, error, { metadata });
}

/**
 * Replace console.debug with structured logging
 */
export function logDebug(
  functionName: string,
  message: string,
  metadata?: Record<string, unknown>,
  supabase?: SupabaseClient
): void {
  const logger = getLogger(functionName, supabase);
  logger.debug(message, { metadata });
}
