/**
 * Analytics Processing Worker
 * Sprint 6: Event-Driven Analytics
 * 
 * Background worker that processes queued analytics events.
 * Runs periodically to move analytics from queue to permanent storage.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processAnalyticsQueue, cleanupProcessedEvents } from '../shared/analytics.ts';
import { ANALYTICS_BATCH_SIZE } from '../shared/constants.ts';
import { logInfo, logError } from '../shared/logger-utils.ts';

Deno.serve(async (req) => {
  // Only allow POST requests (can be called by cron or manually)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  logInfo('process-analytics', 'Starting analytics processing...', {}, supabase);
  const startTime = Date.now();

  try {
    // Process queued events
    const processedCount = await processAnalyticsQueue(supabase, ANALYTICS_BATCH_SIZE);
    
    // Cleanup old processed events (older than 7 days)
    const cleanedCount = await cleanupProcessedEvents(supabase, 7);
    
    const duration = Date.now() - startTime;
    
    const result = {
      success: true,
      processedEvents: processedCount,
      cleanedEvents: cleanedCount,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };

    logInfo('process-analytics', 'Analytics processing complete', result, supabase);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    logError('process-analytics', 'Analytics processing failed', error instanceof Error ? error : new Error(String(error)), {}, supabase);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});
