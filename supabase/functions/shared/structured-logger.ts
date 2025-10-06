/**
 * Structured Logger for JSON Logging
 * Sprint 5: Observability
 * 
 * Provides structured logging with context and metadata for better observability.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  userId?: string;
  conversationId?: string;
  functionName?: string;
  durationMs?: number;
  errorStack?: string;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
}

/**
 * Structured logger that logs to both console and database
 */
export class StructuredLogger {
  private functionName: string;
  private supabase?: SupabaseClient;
  private startTime: number;

  constructor(functionName: string, supabase?: SupabaseClient) {
    this.functionName = functionName;
    this.supabase = supabase;
    this.startTime = Date.now();
  }

  /**
   * Log a message with structured context
   */
  private async log(level: LogLevel, message: string, context?: Partial<LogContext>) {
    const timestamp = new Date().toISOString();
    const durationMs = Date.now() - this.startTime;

    const logEntry = {
      timestamp,
      level,
      message,
      function: this.functionName,
      duration_ms: durationMs,
      ...context,
    };

    // Always log to console
    const consoleMethod = level === 'error' || level === 'fatal' ? 'error' : 
                          level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](JSON.stringify(logEntry));

    // Optionally log to database for persistence
    if (this.supabase && (level === 'error' || level === 'fatal' || level === 'warn')) {
      try {
        await this.supabase.from('structured_logs').insert({
          timestamp: new Date(),
          level,
          message,
          context: context?.metadata,
          user_id: context?.userId,
          conversation_id: context?.conversationId,
          function_name: this.functionName,
          duration_ms: durationMs,
          error_stack: context?.errorStack,
          metadata: context?.metadata,
        });
      } catch (err) {
        // Don't throw on logging errors
        console.error('Failed to write log to database:', err);
      }
    }
  }

  debug(message: string, context?: Partial<LogContext>) {
    return this.log('debug', message, context);
  }

  info(message: string, context?: Partial<LogContext>) {
    return this.log('info', message, context);
  }

  warn(message: string, context?: Partial<LogContext>) {
    return this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Partial<LogContext>) {
    return this.log('error', message, {
      ...context,
      errorStack: error?.stack,
      metadata: {
        ...context?.metadata,
        errorName: error?.name,
        errorMessage: error?.message,
      },
    });
  }

  fatal(message: string, error?: Error, context?: Partial<LogContext>) {
    return this.log('fatal', message, {
      ...context,
      errorStack: error?.stack,
      metadata: {
        ...context?.metadata,
        errorName: error?.name,
        errorMessage: error?.message,
      },
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    const childLogger = new StructuredLogger(this.functionName, this.supabase);
    
    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = async (level: LogLevel, message: string, context?: Partial<LogContext>) => {
      return originalLog(level, message, { ...additionalContext, ...context });
    };
    
    return childLogger;
  }
}

/**
 * Create a new structured logger instance
 */
export function createLogger(functionName: string, supabase?: SupabaseClient): StructuredLogger {
  return new StructuredLogger(functionName, supabase);
}
