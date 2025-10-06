/**
 * Analytics & Event Queue
 * Sprint 6: Code Cleanup - Merged analytics.ts + analytics-queue.ts
 * 
 * Unified module for logging analytics, caching responses, and queueing analytics events
 */

import { hashQuery } from './learning.ts';
import { filterPII } from './pii-filter.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AnalyticsContext {
  supabaseClient: any;
  conversationId: string;
  userId: string;
  assistantMessageId?: string;
}

export interface AnalyticsData {
  query: string;
  queryType: string;
  processingTimeMs: number;
  cacheHit: boolean;
  model: string;
  provider: string;
  toolsCalled?: string[];
  knowledgeUsed?: string[];
  entitiesUsed?: Record<string, any>;
}

/**
 * Analytics event data structure (from analytics-queue)
 */
export interface AnalyticsEvent {
  eventType: 'query' | 'cache_hit' | 'tool_call' | 'error' | 'timeout';
  eventData: Record<string, any>;
  conversationId?: string;
  userId?: string;
}

/**
 * Log analytics for a query
 */
export async function logQueryAnalytics(
  context: AnalyticsContext,
  data: AnalyticsData
): Promise<void> {
  const { supabaseClient, conversationId, userId, assistantMessageId } = context;
  const filteredQuery = filterPII(data.query);
  
  try {
    await supabaseClient.from('query_analytics').insert({
      conversation_id: conversationId,
      user_id: userId,
      assistant_message_id: assistantMessageId,
      query: filteredQuery.filteredText.slice(0, 200), // Truncated
      query_hash: await hashQuery(filteredQuery.filteredText),
      query_type: data.queryType,
      processing_time_ms: data.processingTimeMs,
      cache_hit: data.cacheHit,
      model_used: data.model,
      provider: data.provider,
      tools_called: data.toolsCalled && data.toolsCalled.length > 0 ? data.toolsCalled : null,
      knowledge_used: data.knowledgeUsed && data.knowledgeUsed.length > 0 ? data.knowledgeUsed : null,
      entities_used: data.entitiesUsed && Object.keys(data.entitiesUsed).length > 0 ? data.entitiesUsed : null,
      metadata: {
        piiDetected: filteredQuery.containsPII,
      }
    });
  } catch (error) {
    console.error('Failed to log analytics:', error);
    // Don't throw - analytics failure shouldn't crash the main flow
  }
}

/**
 * Cache a response for future use
 */
export async function cacheResponse(
  supabaseClient: any,
  question: string,
  response: string,
  options: {
    confidenceScore?: number;
    expiresInDays?: number;
  } = {}
): Promise<void> {
  const { confidenceScore = 0.8, expiresInDays = 14 } = options;
  
  try {
    const filteredQuestion = filterPII(question);
    const filteredResponse = filterPII(response);
    const normalized = filteredQuestion.filteredText.toLowerCase().trim();
    const questionHash = await hashQuery(normalized);
    
    const { error: cacheError } = await supabaseClient.from('response_cache').upsert({
      question_hash: questionHash,
      question_text: filteredQuestion.filteredText,
      cached_response: filteredResponse.filteredText,
      context_used: {},
      confidence_score: confidenceScore,
      expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      onConflict: 'question_hash',
      ignoreDuplicates: true,
    });

    if (cacheError && cacheError.code !== '23505') {
      console.error('Cache write failed:', cacheError);
    }
  } catch (error) {
    console.error('Failed to cache response:', error);
    // Don't throw - caching failure shouldn't crash the main flow
  }
}

// ============================================
// Analytics Queue Functions (merged from analytics-queue.ts)
// ============================================

/**
 * Enqueue an analytics event for async processing
 * This allows the main request to complete faster without waiting for analytics
 */
export async function enqueueAnalyticsEvent(
  supabase: SupabaseClient,
  event: AnalyticsEvent
): Promise<void> {
  try {
    const { error } = await supabase
      .from('analytics_queue')
      .insert({
        event_type: event.eventType,
        event_data: event.eventData,
        conversation_id: event.conversationId,
        user_id: event.userId,
      });

    if (error) {
      console.error('Failed to enqueue analytics event:', error);
    }
  } catch (err) {
    // Don't throw - analytics failure shouldn't crash the main flow
    console.error('Analytics queue error:', err);
  }
}

/**
 * Process queued analytics events in batch
 * This should be called by a background worker
 */
export async function processAnalyticsQueue(
  supabase: SupabaseClient,
  batchSize: number = 100
): Promise<number> {
  try {
    // Fetch unprocessed events
    const { data: events, error: fetchError } = await supabase
      .from('analytics_queue')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError || !events || events.length === 0) {
      return 0;
    }

    console.log(`Processing ${events.length} analytics events...`);

    // Process each event
    let processedCount = 0;
    
    for (const event of events) {
      try {
        await processAnalyticsEvent(supabase, event);
        
        // Mark as processed
        await supabase
          .from('analytics_queue')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', event.id);
        
        processedCount++;
      } catch (error) {
        // Log error but continue processing other events
        console.error(`Failed to process analytics event ${event.id}:`, error);
        
        await supabase
          .from('analytics_queue')
          .update({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            processed_at: new Date().toISOString()
          })
          .eq('id', event.id);
      }
    }

    console.log(`Processed ${processedCount}/${events.length} analytics events successfully`);
    return processedCount;
    
  } catch (error) {
    console.error('Analytics queue processing error:', error);
    return 0;
  }
}

/**
 * Process a single analytics event
 * Maps events to their corresponding analytics tables
 */
async function processAnalyticsEvent(
  supabase: SupabaseClient,
  event: any
): Promise<void> {
  const { event_type, event_data, conversation_id, user_id } = event;

  switch (event_type) {
    case 'query':
      await supabase.from('query_analytics').insert({
        conversation_id,
        user_id,
        assistant_message_id: event_data.assistantMessageId,
        query: event_data.query?.slice(0, 200),
        query_hash: event_data.queryHash,
        query_type: event_data.queryType,
        processing_time_ms: event_data.processingTimeMs,
        cache_hit: event_data.cacheHit,
        model_used: event_data.model,
        provider: event_data.provider,
        tools_called: event_data.toolsCalled,
        knowledge_used: event_data.knowledgeUsed,
        entities_used: event_data.entitiesUsed,
        metadata: event_data.metadata || {},
      });
      break;

    case 'cache_hit':
      // Already handled by query analytics with cache_hit flag
      break;

    case 'tool_call':
      // Tool calls are tracked in query_analytics.tools_called array
      break;

    case 'error':
    case 'timeout':
      // These could be tracked in a separate errors table if needed
      console.log(`${event_type} event:`, event_data);
      break;

    default:
      console.warn(`Unknown analytics event type: ${event_type}`);
  }
}

/**
 * Cleanup old processed events
 * Should be called periodically to prevent table bloat
 */
export async function cleanupProcessedEvents(
  supabase: SupabaseClient,
  olderThanDays: number = 7
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabase
      .from('analytics_queue')
      .delete()
      .not('processed_at', 'is', null)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Failed to cleanup analytics queue:', error);
      return 0;
    }

    const deletedCount = data?.length || 0;
    console.log(`Cleaned up ${deletedCount} processed analytics events`);
    return deletedCount;
  } catch (error) {
    console.error('Analytics cleanup error:', error);
    return 0;
  }
}
