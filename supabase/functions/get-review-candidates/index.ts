import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logError } from '../shared/logger-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check role (admin or owner)
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });
    const { data: isOwner } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'owner'
    });

    if (!isAdmin && !isOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin or owner role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent analytics entries where knowledge_used is empty/null
    // These are responses that might benefit from being added to KB
    const { data: analytics, error: analyticsError } = await supabase
      .from('query_analytics')
      .select(`
        id,
        conversation_id,
        assistant_message_id,
        query,
        knowledge_used,
        created_at,
        model_used,
        processing_time_ms
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (analyticsError) {
      logError('get-review-candidates', 'Analytics query error', analyticsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch analytics', detail: analyticsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter for entries without knowledge sources
    const candidates = (analytics || []).filter(
      (entry: any) => !entry.knowledge_used || entry.knowledge_used.length === 0
    );

    // Fetch corresponding messages for context
    const messageIds = candidates
      .map((c: any) => c.assistant_message_id)
      .filter(Boolean);

    let messagesMap = new Map();
    
    if (messageIds.length > 0) {
      const { data: messages } = await supabase
        .from('messages')
        .select('id, content, created_at')
        .in('id', messageIds);

      if (messages) {
        messages.forEach((msg: any) => {
          messagesMap.set(msg.id, msg);
        });
      }
    }

    // Enrich candidates with message content
    const enrichedCandidates = candidates.map((candidate: any) => {
      const message = candidate.assistant_message_id 
        ? messagesMap.get(candidate.assistant_message_id)
        : null;

      return {
        id: candidate.id,
        conversation_id: candidate.conversation_id,
        assistant_message_id: candidate.assistant_message_id,
        query: candidate.query,
        answer_preview: message ? message.content.slice(0, 200) : null,
        created_at: candidate.created_at,
        model_used: candidate.model_used,
        processing_time_ms: candidate.processing_time_ms,
      };
    });

    return new Response(
      JSON.stringify({ candidates: enrichedCandidates }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('get-review-candidates', 'Get review candidates error', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
