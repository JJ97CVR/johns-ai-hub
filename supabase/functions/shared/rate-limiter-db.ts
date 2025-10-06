/**
 * Database-based Rate Limiter
 * Sprint 5: Security & Observability
 * Sprint 6: Code Cleanup
 * 
 * Alternative to Deno.KV for environments where KV is not available.
 * Uses Supabase database for rate limit state storage.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { RateLimitResult } from './rate-limiter-types.ts';

/**
 * Check rate limit for a given identifier (user ID or IP address)
 * 
 * @param identifier - User ID or IP address
 * @param identifierType - Type of identifier ('user' or 'ip')
 * @param limit - Maximum requests allowed in the window
 * @param windowMinutes - Time window in minutes (default: 60)
 * @param endpoint - API endpoint being rate limited (default: 'chat')
 * @returns Promise<RateLimitResult>
 */
export async function checkRateLimitDB(
  identifier: string,
  identifierType: 'user' | 'ip',
  limit: number = 100,
  windowMinutes: number = 60,
  endpoint: string = 'chat'
): Promise<RateLimitResult> {
  
  // Create Supabase client with service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const windowStart = new Date(Date.now() - windowMinutes * 60000);
  const column = identifierType === 'user' ? 'user_id' : 'ip_address';
  
  try {
    // Check for existing rate limit record within window
    const { data: existingRecord, error: fetchError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq(column, identifier)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString())
      .order('window_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (fetchError) {
      console.error('❌ Rate limit fetch error:', fetchError);
      // Fail open - allow request if DB check fails
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: Date.now() + (windowMinutes * 60000)
      };
    }
    
    // No existing record - first request in window
    if (!existingRecord) {
      const { error: insertError } = await supabase
        .from('rate_limits')
        .insert({
          [column]: identifier,
          endpoint: endpoint,
          request_count: 1,
          window_start: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('❌ Rate limit insert error:', insertError);
        // Fail open
        return {
          allowed: true,
          remaining: limit - 1,
          resetAt: Date.now() + (windowMinutes * 60000)
        };
      }
      
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: Date.now() + (windowMinutes * 60000)
      };
    }
    
    // Check if limit exceeded
    if (existingRecord.request_count >= limit) {
      const resetAt = new Date(existingRecord.window_start).getTime() + (windowMinutes * 60000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: resetAt
      };
    }
    
    // Increment request count
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({ request_count: existingRecord.request_count + 1 })
      .eq('id', existingRecord.id);
    
    if (updateError) {
      console.error('❌ Rate limit update error:', updateError);
      // Fail open but log the issue
      return {
        allowed: true,
        remaining: limit - existingRecord.request_count - 1,
        resetAt: new Date(existingRecord.window_start).getTime() + (windowMinutes * 60000)
      };
    }
    
    return {
      allowed: true,
      remaining: limit - existingRecord.request_count - 1,
      resetAt: new Date(existingRecord.window_start).getTime() + (windowMinutes * 60000)
    };
    
  } catch (error) {
    console.error('❌ Rate limiter error:', error);
    // Fail open - allow request if unexpected error
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: Date.now() + (windowMinutes * 60000)
    };
  }
}
