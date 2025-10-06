// Learning System - Conversation insights, pattern learning, and knowledge base promotion
// Handles post-conversation learning and automatic knowledge base population

import { filterPII } from './pii-filter.ts';

/**
 * Generate SHA-256 hash of query text (matches DB function)
 */
export async function hashQuery(query: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(query);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Learn from conversation and optionally promote to knowledge base
 * FIX P0: Improved Learning System with RAG auto-promotion
 */
export async function learnFromConversation(
  supabase: any, 
  conversationId: string, 
  messageId: string,
  userId: string,
  userMessage: string, 
  assistantResponse: string
) {
  try {
    console.log('🧠 Starting learning process...');

    // Generate embedding for conversation
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const conversationText = `User: ${userMessage}\nAssistant: ${assistantResponse}`;
    let embeddingVector: number[] | null = null;
    
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
            input: conversationText,
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          embeddingVector = embeddingData.data[0].embedding;
          console.log('✅ Generated embedding vector');
        } else {
          console.warn('⚠️  Embedding generation returned non-OK status');
        }
      } catch (error) {
        console.error('❌ Embedding generation failed:', error);
      }
    } else {
      console.warn('⚠️  OpenAI API key not available - skipping embedding generation');
    }

    // SPRINT 2: Removed conversation_insights (unused feature)
    
    // Save learned pattern if response is substantial
    if (assistantResponse.length > 50) {
      const { error: patternError } = await supabase
        .from('learned_patterns')
        .insert({
          question_pattern: userMessage.slice(0, 100),
          answer_template: assistantResponse.slice(0, 300),
          usage_count: 1,
          success_rate: 1.0,
          example_questions: [userMessage.slice(0, 100)],
          embedding: embeddingVector,
        });

      if (patternError) {
        console.error('❌ Failed to save learned pattern:', patternError);
      } else {
        console.log('✅ Saved learned pattern');
      }
    }

    // Cache good responses with PII filtering
    const filteredQuestion = filterPII(userMessage);
    const filteredResponse = filterPII(assistantResponse);
    const normalized = filteredQuestion.filteredText.toLowerCase().trim();
    const questionHash = await hashQuery(normalized);
    
    // Sprint 1: Fix cache upsert with proper conflict handling
    const { error: cacheError } = await supabase.from('response_cache').upsert({
      question_hash: questionHash,
      question_text: filteredQuestion.filteredText,
      cached_response: filteredResponse.filteredText,
      context_used: {},
      confidence_score: 0.8,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      onConflict: 'question_hash',
      ignoreDuplicates: false  // Update existing entry
    });

    if (cacheError) {
      // Sprint 1: Ignore duplicate key errors (23505) - it's OK!
      if (cacheError.code !== '23505') {
        console.error('❌ Failed to cache response:', cacheError);
      } else {
        console.log('ℹ️  Cache entry already exists (updated)');
      }
    } else {
      console.log('✅ Cached response');
    }

    // FIX P0: Auto-promote important conversations to knowledge base
    const shouldPromote = (
      userMessage.match(/kom ihåg|spara|remember|viktigt|important/i) ||
      assistantResponse.length > 200 ||
      assistantResponse.includes('Källor:') ||
      assistantResponse.match(/\d{4}-\d{2}-\d{2}|^\d+\s*(kr|sek|€|\$)/)
    );

    if (shouldPromote && embeddingVector) {
      console.log('🎯 Promoting conversation to knowledge base...');
      
      // Track promotion
      const { error: promotionTrackError } = await supabase
        .from('conversation_promotions')
        .insert({
          conversation_id: conversationId,
          message_id: messageId,
          promoted_to_kb: true,
          promotion_reason: 'Auto-promoted: Important conversation detected',
          importance_score: assistantResponse.length / 1000, // Simple score based on length
        });
      
      if (promotionTrackError) {
        console.error('❌ Failed to track promotion:', promotionTrackError);
      }
      
      // Promote to knowledge base
      const { error: kbError } = await supabase
        .from('knowledge_base')
        .insert({
          title: `Conversation: ${userMessage.slice(0, 50)}...`,
          content: `Fråga: ${userMessage}\n\nSvar: ${assistantResponse}`,
          source: `conversation:${conversationId}`,
          embedding: embeddingVector,
          category: 'learned_conversation',
          metadata: {
            conversation_id: conversationId,
            message_id: messageId,
            user_id: userId,
            promoted_at: new Date().toISOString(),
            response_length: assistantResponse.length,
          }
        });
      
      if (kbError) {
        console.error('❌ Failed to promote to knowledge base:', kbError);
      } else {
        console.log('✅ Successfully promoted to knowledge base!');
      }
    }

    console.log('✅ Learning process completed');
  } catch (error) {
    console.error('❌ Learning process failed:', error);
    // Don't throw - learning failure shouldn't crash the main flow
  }
}
