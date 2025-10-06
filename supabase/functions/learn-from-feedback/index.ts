import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logInfo, logError } from '../shared/logger-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash question for cache invalidation
async function hashQuestion(text: string): Promise<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\såäö]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    logInfo('learn-from-feedback', 'Starting auto-learning from feedback...');

    // ============================================================
    // STEP 1: INVALIDATE BAD CACHE ENTRIES
    // ============================================================
    
    // Find messages with negative feedback (within last 7 days)
    const { data: badFeedback, error: badError } = await supabase
      .from('message_feedback')
      .select(`
        message_id,
        messages!inner(id, content, conversation_id, role)
      `)
      .eq('helpful', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (badError) {
      logError('learn-from-feedback', 'Failed to fetch bad feedback', badError);
    } else if (badFeedback && badFeedback.length > 0) {
      logInfo('learn-from-feedback', `Found ${badFeedback.length} messages with negative feedback`, { count: badFeedback.length });

      let invalidatedCount = 0;
      for (const feedback of badFeedback) {
        const msg = feedback.messages as any;
        
        // Get the user's question (previous message)
        const { data: userMessages } = await supabase
          .from('messages')
          .select('content')
          .eq('conversation_id', msg.conversation_id)
          .eq('role', 'user')
          .lt('created_at', msg.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (userMessages?.content) {
          const questionHash = await hashQuestion(userMessages.content);
          
          // Invalidate cache entry
          const { error: deleteError } = await supabase
            .from('response_cache')
            .delete()
            .eq('question_hash', questionHash);

          if (!deleteError) {
            invalidatedCount++;
            logInfo('learn-from-feedback', `Invalidated cache for: "${userMessages.content.substring(0, 50)}..."`, { question: userMessages.content.substring(0, 100) });
          }
        }
      }

      logInfo('learn-from-feedback', `Invalidated ${invalidatedCount} bad cache entries`, { invalidatedCount });
    }

    // ============================================================
    // STEP 2: PROMOTE HIGH-QUALITY RESPONSES TO KB
    // ============================================================
    
    let promotedCount = 0;
    
    // Find messages with positive feedback (3+ thumbs up, no thumbs down)
    const { data: goodFeedback, error: goodError } = await supabase
      .rpc('get_promotable_messages', {});

    // Fallback query if RPC doesn't exist
    const { data: promotableFeedback } = await supabase
      .from('message_feedback')
      .select(`
        message_id,
        messages!inner(id, content, conversation_id, role, created_at)
      `)
      .eq('helpful', true)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (promotableFeedback && promotableFeedback.length > 0) {
      // Group by message_id and count
      const messageCounts = new Map<string, { count: number; msg: any }>();
      
      for (const feedback of promotableFeedback) {
        const msgId = feedback.message_id;
        const existing = messageCounts.get(msgId);
        
        if (existing) {
          existing.count++;
        } else {
          messageCounts.set(msgId, { 
            count: 1, 
            msg: feedback.messages 
          });
        }
      }

      // Filter messages with 3+ positive feedback
      const highQualityMessages = Array.from(messageCounts.entries())
        .filter(([_, data]) => data.count >= 3)
        .map(([msgId, data]) => ({ msgId, ...data }));

      logInfo('learn-from-feedback', `Found ${highQualityMessages.length} high-quality messages to promote`, { count: highQualityMessages.length });

      for (const { msgId, msg } of highQualityMessages) {
        // Check if already promoted
        const { data: existing } = await supabase
          .from('conversation_promotions')
          .select('id')
          .eq('message_id', msgId)
          .eq('promoted_to_kb', true)
          .maybeSingle();

        if (!existing) {
          // Get the user's question
          const { data: userMessages } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', msg.conversation_id)
            .eq('role', 'user')
            .lt('created_at', msg.created_at)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (userMessages?.content) {
            // Check if already in KB
            const { data: kbExists } = await supabase
              .from('knowledge_base')
              .select('id')
              .eq('content', msg.content)
              .maybeSingle();

            if (!kbExists) {
              // Generate embedding
              const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
              if (openAIApiKey) {
                try {
                  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${openAIApiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'text-embedding-3-small',
                      input: msg.content,
                    }),
                  });

                  const embeddingData = await embeddingResponse.json();
                  const embedding = embeddingData.data[0].embedding;

                  // Promote to KB
                  const { error: kbError } = await supabase
                    .from('knowledge_base')
                    .insert({
                      title: `User-approved: ${userMessages.content.substring(0, 100)}`,
                      content: msg.content,
                      category: 'user_feedback',
                      source: 'auto_promoted',
                      confidence_score: 0.95,
                      embedding,
                      metadata: {
                        original_question: userMessages.content,
                        positive_feedback_count: messageCounts.get(msgId)?.count || 0,
                        promoted_at: new Date().toISOString(),
                      }
                    });

                  if (!kbError) {
                    // Mark as promoted
                    await supabase
                      .from('conversation_promotions')
                      .upsert({
                        message_id: msgId,
                        conversation_id: msg.conversation_id,
                        promoted_to_kb: true,
                        importance_score: 0.95,
                        promotion_reason: 'High user satisfaction (3+ positive feedback)',
                      });

                    promotedCount++;
                    logInfo('learn-from-feedback', `Promoted to KB: "${userMessages.content.substring(0, 50)}..."`, { question: userMessages.content.substring(0, 100), msgId });
                  }
                } catch (embError) {
                  logError('learn-from-feedback', 'Failed to generate embedding', embError instanceof Error ? embError : new Error(String(embError)), { msgId });
                }
              }
            }
          }
        }
      }

      logInfo('learn-from-feedback', `Promoted ${promotedCount} responses to knowledge base`, { promotedCount });
    }

    // ============================================================
    // STEP 3: GENERATE SUMMARY REPORT
    // ============================================================
    
    const { data: stats } = await supabase
      .from('message_feedback')
      .select('helpful')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const totalFeedback = stats?.length || 0;
    const positiveFeedback = stats?.filter(s => s.helpful).length || 0;
    const satisfactionRate = totalFeedback > 0 
      ? Math.round((positiveFeedback / totalFeedback) * 100) 
      : 0;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_feedback_last_7_days: totalFeedback,
        positive_feedback: positiveFeedback,
        negative_feedback: totalFeedback - positiveFeedback,
        satisfaction_rate: `${satisfactionRate}%`,
      },
      actions: {
        cache_entries_invalidated: badFeedback?.length || 0,
        responses_promoted_to_kb: promotedCount || 0,
      }
    };

    logInfo('learn-from-feedback', 'Auto-learning report', report);

    return new Response(
      JSON.stringify({
        success: true,
        report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    logError('learn-from-feedback', 'Auto-learning error', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
