import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logInfo, logError } from '../shared/logger-utils.ts';

// Secure CORS - only allow specific origins
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean);
const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create client with user's token to verify auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has admin or owner role
    const { data: roleCheck } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    const { data: ownerCheck } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'owner'
    });

    if (!roleCheck && !ownerCheck) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin or owner role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client to fetch stats
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch counts from all tables
    const [kb, patterns, cache, facts] = await Promise.all([
      supabase.from('knowledge_base').select('*', { count: 'exact', head: true }),
      supabase.from('learned_patterns').select('*', { count: 'exact', head: true }),
      supabase.from('response_cache').select('*', { count: 'exact', head: true }),
      supabase.from('organization_facts').select('*', { count: 'exact', head: true }),
    ]);

    // Get aggregated analytics using the secure function (via user's client for RLS)
    // This returns anonymized stats without exposing individual user queries
    const { data: analyticsData, error: analyticsError } = await supabaseClient.rpc(
      'get_aggregated_analytics',
      { days_back: 30 }
    );

    if (analyticsError) {
      logError('get-knowledge-stats', 'Error fetching analytics', analyticsError);
    }

    const stats = {
      knowledgeItems: kb.count || 0,
      learnedPatterns: patterns.count || 0,
      cachedResponses: cache.count || 0,
      orgFacts: facts.count || 0,
      analytics: analyticsError ? null : (Array.isArray(analyticsData) && analyticsData.length > 0 ? analyticsData[0] : null),
    };

    logInfo('get-knowledge-stats', 'Knowledge stats fetched', stats);

    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logError('get-knowledge-stats', 'Error in get-knowledge-stats function', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
