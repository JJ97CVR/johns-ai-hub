/**
 * Get Metrics Dashboard Data
 * Sprint 7: Metrics Dashboard
 * 
 * Aggregates observability data for admin dashboard
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logError } from '../shared/logger-utils.ts';
import { getCorsHeaders } from '../shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin or owner role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userRoles = roles.map(r => r.role);
    if (!userRoles.includes('admin') && !userRoles.includes('owner')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for querying analytics
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch metrics data in parallel
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      errorLogsResult,
      queryAnalyticsResult,
      modelRateLimitsResult,
      adminAuditResult,
      recentErrorsResult,
    ] = await Promise.all([
      // Error logs count by level (last 24h)
      serviceSupabase
        .from('structured_logs')
        .select('level')
        .gte('timestamp', last24h.toISOString())
        .in('level', ['error', 'fatal', 'warn']),

      // Query analytics aggregates (last 7 days)
      serviceSupabase
        .from('query_analytics')
        .select('model_used, processing_time_ms, cache_hit, tools_called')
        .gte('created_at', last7d.toISOString()),

      // Current rate limit status
      serviceSupabase
        .from('model_rate_limits')
        .select('model, user_id, request_count, window_start')
        .gte('window_start', new Date(now.getTime() - 60 * 60 * 1000).toISOString()),

      // Admin activity (last 30 days)
      serviceSupabase
        .from('admin_audit_log')
        .select('action, target_type, created_at')
        .gte('created_at', last30d.toISOString())
        .order('created_at', { ascending: false }),

      // Recent error details
      serviceSupabase
        .from('structured_logs')
        .select('message, level, function_name, timestamp, metadata')
        .in('level', ['error', 'fatal'])
        .gte('timestamp', last24h.toISOString())
        .order('timestamp', { ascending: false })
        .limit(10),
    ]);

    // Process error logs
    const errorLogs = errorLogsResult.data || [];
    const errorCounts = {
      error: errorLogs.filter(l => l.level === 'error').length,
      fatal: errorLogs.filter(l => l.level === 'fatal').length,
      warn: errorLogs.filter(l => l.level === 'warn').length,
    };

    // Process query analytics
    const analytics = queryAnalyticsResult.data || [];
    const totalQueries = analytics.length;
    const avgProcessingTime = analytics.length > 0
      ? Math.round(analytics.reduce((sum, a) => sum + (a.processing_time_ms || 0), 0) / analytics.length)
      : 0;
    const cacheHitRate = analytics.length > 0
      ? Math.round((analytics.filter(a => a.cache_hit).length / analytics.length) * 100)
      : 0;

    // Model usage breakdown
    const modelUsage: Record<string, number> = {};
    analytics.forEach(a => {
      if (a.model_used) {
        modelUsage[a.model_used] = (modelUsage[a.model_used] || 0) + 1;
      }
    });

    // Tool usage breakdown
    const toolUsage: Record<string, number> = {};
    analytics.forEach(a => {
      if (a.tools_called && Array.isArray(a.tools_called)) {
        a.tools_called.forEach((tool: string) => {
          toolUsage[tool] = (toolUsage[tool] || 0) + 1;
        });
      }
    });

    // Process rate limits
    const rateLimits = modelRateLimitsResult.data || [];
    const activeRateLimits = rateLimits.length;
    const uniqueUsers = new Set(rateLimits.map(r => r.user_id)).size;

    // Process admin activity
    const auditLogs = adminAuditResult.data || [];
    const recentActions = auditLogs.slice(0, 5);

    // Process recent errors
    const recentErrors = recentErrorsResult.data || [];

    // Compile metrics
    const metrics = {
      overview: {
        totalQueries,
        avgProcessingTime,
        cacheHitRate,
        activeRateLimits,
        uniqueUsers,
      },
      errors: {
        counts: errorCounts,
        recent: recentErrors,
      },
      models: modelUsage,
      tools: toolUsage,
      adminActivity: recentActions,
      timestamp: now.toISOString(),
    };

    return new Response(
      JSON.stringify({ metrics }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    logError('get-metrics', 'Metrics error', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
