import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../shared/cors.ts";
import { logInfo, logError } from "../shared/logger-utils.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Sprint 4: Scheduled cleanup of old data based on retention policies
 * 
 * Schedule this function to run daily via pg_cron:
 * 
 * SELECT cron.schedule(
 *   'cleanup-old-data-daily',
 *   '0 2 * * *', -- Run at 2 AM daily
 *   $$
 *   SELECT net.http_post(
 *     url:='https://vvgcvyulcrgdtuzdobgn.supabase.co/functions/v1/cleanup-old-data',
 *     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
 *     body:='{}'::jsonb
 *   ) as request_id;
 *   $$
 * );
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    logInfo('cleanup-old-data', 'Starting data retention cleanup...');

    // Call the unified cleanup function
    const { data, error } = await supabase.rpc('cleanup_old_data');

    if (error) {
      logError('cleanup-old-data', 'Cleanup failed', error);
      throw error;
    }

    const summary = data.reduce((acc: any, row: any) => {
      acc[row.table_name] = row.rows_deleted;
      acc.total = (acc.total || 0) + row.rows_deleted;
      return acc;
    }, {});

    logInfo('cleanup-old-data', 'Cleanup completed', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    logError('cleanup-old-data', 'Cleanup error', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
