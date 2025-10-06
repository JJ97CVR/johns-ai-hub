/**
 * Database Retry Logic
 * Provides retry functionality for transient database errors
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const retryableCodes = ['PGRST301', '40001', '40P01']; // Connection timeout, serialization failure, deadlock
  const retryableMessages = [
    'timeout',
    'connection',
    'network',
    'temporarily unavailable',
  ];
  
  // Check error code
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }
  
  // Check error message
  const errorMessage = (error.message || '').toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Retry a database operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 5000,
  } = options;
  
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      const isLastAttempt = attempt === maxRetries;
      const shouldRetry = isRetryableError(error);
      
      if (isLastAttempt || !shouldRetry) {
        throw error;
      }
      
      // Calculate backoff delay with exponential growth and cap
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      
      console.warn(
        `⚠️ Database operation failed (attempt ${attempt}/${maxRetries}), ` +
        `retrying in ${delay}ms...`,
        { error: error.message, code: error.code }
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Wrapper for Supabase query with retry
 */
export async function withRetryQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  return withRetry(async () => {
    const result = await queryFn();
    
    // If there's an error, throw it so retry logic can handle it
    if (result.error) {
      throw result.error;
    }
    
    return result;
  }, options);
}
