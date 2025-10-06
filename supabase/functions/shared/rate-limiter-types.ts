/**
 * Common Rate Limiter Types
 * Sprint 6: Code Cleanup
 * 
 * Standardized interfaces for all rate limiting implementations
 */

/**
 * Standardized rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** When the rate limit resets (timestamp or Date) */
  resetAt: Date | number;
  /** Optional: The rate limit ceiling */
  limit?: number;
}

/**
 * Common interface for all rate limiters
 */
export interface RateLimiter {
  check(identifier: string, ...args: any[]): Promise<RateLimitResult>;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxTokens: number;
  /** Rate at which tokens refill (tokens per second) */
  refillRate: number;
  /** Time window in milliseconds */
  window: number;
}
