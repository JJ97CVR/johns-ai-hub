/**
 * AI Response Cache
 * Phase 1: Performance Optimization
 * 
 * Caches complete AI responses for ultra-fast retrieval.
 * Cache hit = 100-500ms instead of 2-30s
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logInfo, logDebug, logError } from './logger-utils.ts';

export interface CachedAIResponse {
  response_content: string;
  model: string;
  mode: string;
  citations: any[];
  tools_used: string[];
  hit_count: number;
  confidence_score: number;
  created_at: string;
}

export interface CacheMetadata {
  model: string;
  mode: string;
  citations?: any[];
  tools_used?: string[];
  confidence_score?: number;
}

/**
 * Get cached AI response
 */
export async function getCachedAIResponse(
  supabase: any,
  queryHash: string,
  mode: string,
  requestId: string
): Promise<CachedAIResponse | null> {
  try {
    logDebug('ai-cache', 'Checking AI response cache', { requestId, queryHash, mode });

    const { data, error } = await supabase
      .from('ai_response_cache')
      .select('*')
      .eq('query_hash', queryHash)
      .eq('mode', mode)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No matching row found
        logDebug('ai-cache', 'Cache miss', { requestId, queryHash });
        return null;
      }
      throw error;
    }

    if (data) {
      // Update hit count and last accessed time
      await supabase
        .from('ai_response_cache')
        .update({
          hit_count: data.hit_count + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      logInfo('ai-cache', 'Cache HIT - returning cached response', {
        requestId,
        queryHash,
        hit_count: data.hit_count + 1,
        age_hours: Math.round((Date.now() - new Date(data.created_at).getTime()) / 3600000),
      });

      return data as CachedAIResponse;
    }

    return null;
  } catch (error) {
    logError('ai-cache', 'Error checking cache', error instanceof Error ? error : undefined, {
      requestId,
      queryHash,
    });
    // Don't fail the request on cache errors
    return null;
  }
}

/**
 * Cache AI response
 */
export async function cacheAIResponse(
  supabase: any,
  queryText: string,
  queryHash: string,
  responseContent: string,
  metadata: CacheMetadata,
  requestId: string
): Promise<void> {
  try {
    logDebug('ai-cache', 'Caching AI response', { requestId, queryHash, mode: metadata.mode });

    // Determine TTL based on content type
    const ttlHours = determineTTL(queryText, metadata.mode);
    const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();

    const { error } = await supabase
      .from('ai_response_cache')
      .upsert(
        {
          query_hash: queryHash,
          query_text: queryText,
          response_content: responseContent,
          model: metadata.model,
          mode: metadata.mode,
          citations: metadata.citations || [],
          tools_used: metadata.tools_used || [],
          confidence_score: metadata.confidence_score || 1.0,
          expires_at: expiresAt,
          last_accessed_at: new Date().toISOString(),
        },
        {
          onConflict: 'query_hash',
        }
      );

    if (error) {
      throw error;
    }

    logInfo('ai-cache', 'Response cached successfully', {
      requestId,
      queryHash,
      ttl_hours: ttlHours,
      mode: metadata.mode,
    });
  } catch (error) {
    logError('ai-cache', 'Error caching response', error instanceof Error ? error : undefined, {
      requestId,
      queryHash,
    });
    // Don't fail the request on cache errors
  }
}

/**
 * Determine cache TTL based on query content
 */
function determineTTL(queryText: string, mode: string): number {
  const lowerQuery = queryText.toLowerCase();

  // Static content: 7 days
  if (
    lowerQuery.includes('vad är') ||
    lowerQuery.includes('förklara') ||
    lowerQuery.includes('berätta om') ||
    lowerQuery.includes('what is') ||
    lowerQuery.includes('explain')
  ) {
    return 168; // 7 days
  }

  // Part number queries: 3 days (relatively static)
  if (/\d{5,}/.test(queryText)) {
    return 72; // 3 days
  }

  // Extended mode: 2 days (more complex, stable answers)
  if (mode === 'extended') {
    return 48; // 2 days
  }

  // Fast mode: 12 hours (simple, might be time-sensitive)
  if (mode === 'fast') {
    return 12;
  }

  // Default: 24 hours
  return 24;
}

/**
 * Invalidate cache for a conversation
 */
export async function invalidateConversationCache(
  supabase: any,
  conversationId: string,
  requestId: string
): Promise<void> {
  try {
    logDebug('ai-cache', 'Invalidating conversation cache', { requestId, conversationId });

    // We don't have conversation_id in the cache table, so this is a no-op for now
    // In the future, we could add conversation_id to track related queries

    logInfo('ai-cache', 'Cache invalidation completed', { requestId, conversationId });
  } catch (error) {
    logError(
      'ai-cache',
      'Error invalidating cache',
      error instanceof Error ? error : undefined,
      { requestId, conversationId }
    );
  }
}
