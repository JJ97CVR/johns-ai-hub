/**
 * Per-Model Rate Limiter
 * Sprint 5: Security & Observability
 * Sprint 6: Code Cleanup
 * 
 * Enforces usage limits per AI model to manage costs and prevent abuse.
 * Each model has specific rate limits based on its cost and performance.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from "./structured-logger.ts";
import type { RateLimitResult } from './rate-limiter-types.ts';

// Rate limits per model (requests per minute)
export const MODEL_RATE_LIMITS: Record<string, number> = {
  // OpenAI models
  'openai/gpt-5': 10,
  'openai/gpt-5-mini': 20,
  'openai/gpt-5-nano': 30,
  
  // Anthropic models
  'anthropic/claude-sonnet-4-20250514': 10,
  'anthropic/claude-sonnet-4-5-20250929': 10,
  
  // Google models
  'google/gemini-2.5-pro': 15,
  'google/gemini-2.5-flash': 30,
  'google/gemini-2.5-flash-lite': 60,
};

const DEFAULT_RATE_LIMIT = 20; // requests per minute
const WINDOW_SIZE_MS = 60_000; // 1 minute

/**
 * Check if a request is allowed under the model-specific rate limit
 */
export async function checkModelRateLimit(
  supabase: SupabaseClient,
  userId: string | null,
  model: string
): Promise<RateLimitResult> {
  const logger = createLogger('rate-limiter-model', supabase);
  const limit = MODEL_RATE_LIMITS[model] || DEFAULT_RATE_LIMIT;
  const windowStart = new Date(Date.now() - WINDOW_SIZE_MS);

  try {
    // Get or create rate limit record
    const { data: existing, error: fetchError } = await supabase
      .from('model_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('model', model)
      .gte('window_start', windowStart.toISOString())
      .order('window_start', { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      throw fetchError;
    }

    const now = new Date();
    let currentCount = 0;

    if (existing && new Date(existing.window_start) > windowStart) {
      // Existing window is still valid
      currentCount = existing.request_count;

      if (currentCount >= limit) {
        // Rate limit exceeded
        const resetAt = new Date(new Date(existing.window_start).getTime() + WINDOW_SIZE_MS);
        
        await logger.warn('Model rate limit exceeded', {
          userId: userId || undefined,
          metadata: { model, count: currentCount, limit, resetAt },
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          limit,
        };
      }

      // Increment counter
      const { error: updateError } = await supabase
        .from('model_rate_limits')
        .update({ request_count: currentCount + 1 })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }

      currentCount++;
    } else {
      // Create new window
      const { error: insertError } = await supabase
        .from('model_rate_limits')
        .insert({
          user_id: userId,
          model,
          window_start: now,
          request_count: 1,
        });

      if (insertError) {
        throw insertError;
      }

      currentCount = 1;
    }

    return {
      allowed: true,
      remaining: limit - currentCount,
      resetAt: new Date(now.getTime() + WINDOW_SIZE_MS),
      limit,
    };
  } catch (err) {
    await logger.error('Rate limit check failed', err as Error, {
      userId: userId || undefined,
      metadata: { model },
    });

    // Fail open (allow request) to avoid blocking legitimate traffic
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + WINDOW_SIZE_MS),
      limit,
    };
  }
}

/**
 * Get rate limit status for a user across all models
 */
export async function getUserRateLimitStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, RateLimitResult>> {
  const windowStart = new Date(Date.now() - WINDOW_SIZE_MS);
  
  const { data, error } = await supabase
    .from('model_rate_limits')
    .select('*')
    .eq('user_id', userId)
    .gte('window_start', windowStart.toISOString());

  if (error) {
    console.error('Failed to fetch user rate limit status:', error);
    return {};
  }

  const status: Record<string, RateLimitResult> = {};
  
  for (const record of data || []) {
    const limit = MODEL_RATE_LIMITS[record.model] || DEFAULT_RATE_LIMIT;
    const resetAt = new Date(new Date(record.window_start).getTime() + WINDOW_SIZE_MS);
    
    status[record.model] = {
      allowed: record.request_count < limit,
      remaining: Math.max(0, limit - record.request_count),
      resetAt,
      limit,
    };
  }

  return status;
}
