import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEmbedding } from "../shared/knowledge-retrieval.ts";
import { logError } from '../shared/logger-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

interface PromoteRequest {
  conversationId: string;
  messageId: string;
  title?: string;
  category?: string;
}

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

    // Parse request body
    const body = await req.json() as PromoteRequest;
    const { conversationId, messageId, title, category } = body;

    if (!conversationId || !messageId) {
      return new Response(
        JSON.stringify({ error: 'Missing conversationId or messageId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify conversation exists and user has access
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch message
    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .single();

    if (msgErr || !msg) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (msg.role !== 'assistant') {
      return new Response(
        JSON.stringify({ error: 'Only assistant messages can be promoted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare knowledge base entry
    const kbTitle = title?.trim() || `Promoted answer ${messageId.slice(0, 8)}`;
    const kbCategory = category?.trim() || 'promoted';
    const content = msg.content;

    // Generate embedding
    const embedding = await generateEmbedding(content);

    // Insert into knowledge_base
    const { data: inserted, error: insErr } = await supabase
      .from('knowledge_base')
      .insert({
        title: kbTitle,
        content,
        category: kbCategory,
        source: `conversation:${conversationId}#${messageId}`,
        metadata: {
          promoted_by: user.id,
          promoted_at: new Date().toISOString()
        },
        embedding,
        confidence_score: 0.95,
        usage_count: 0,
      })
      .select()
      .single();

    if (insErr) {
      logError('promote-to-kb', 'Insert error', insErr, { conversationId, messageId, title: kbTitle });
      return new Response(
        JSON.stringify({ error: 'Failed to insert into knowledge base', detail: insErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, id: inserted.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('promote-to-kb', 'Promote to KB error', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
