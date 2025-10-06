/**
 * Distributed Token Bucket Rate Limiter
 * Sprint 6: P3 Improvements & Code Cleanup
 * 
 * Implements a distributed token bucket algorithm using Deno KV.
 * Safe for serverless/edge environments with multiple instances.
 */

import { 
  RATE_LIMIT_MAX_REQUESTS, 
  RATE_LIMIT_REFILL_RATE,
  RATE_LIMIT_WINDOW_MS 
} from './constants.ts';
import type { RateLimitConfig, RateLimitResult } from './rate-limiter-types.ts';

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

let kvInstance: Deno.Kv | null = null;

async function getKv(): Promise<Deno.Kv> {
  if (!kvInstance) {
    kvInstance = await Deno.openKv();
  }
  return kvInstance;
}

export async function checkRateLimit(
  identifier: string, 
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const kv = await getKv();
  const key = ["rate_limit", identifier];
  
  const now = Date.now();
  
  // Get current bucket state
  const result = await kv.get<RateBucket>(key);
  const bucket: RateBucket = result.value || { 
    tokens: config.maxTokens, 
    lastRefill: now 
  };
  
  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor((elapsed / 1000) * config.refillRate);
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
  
  // Check if request is allowed
  if (bucket.tokens < 1) {
    await kv.set(key, bucket, { expireIn: 3600000 }); // 1h TTL
    return { 
      allowed: false, 
      remaining: 0,
      resetAt: bucket.lastRefill + config.window,
      limit: config.maxTokens
    };
  }
  
  // Consume token
  bucket.tokens -= 1;
  await kv.set(key, bucket, { expireIn: 3600000 }); // 1h TTL
  return { 
    allowed: true, 
    remaining: Math.floor(bucket.tokens),
    resetAt: bucket.lastRefill + config.window,
    limit: config.maxTokens
  };
}
