/**
 * Cost Tracking for LLM Usage
 * Sprint 1: Observability
 * 
 * Tracks token usage and estimates costs for different models
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Pricing per 1M tokens (in USD)
 * Updated 2025-10-05
 */
export const MODEL_PRICING = {
  // OpenAI GPT-5
  'openai/gpt-5': {
    input: 5.00,
    output: 15.00,
  },
  'openai/gpt-5-mini': {
    input: 0.15,
    output: 0.60,
  },
  'openai/gpt-5-nano': {
    input: 0.03,
    output: 0.12,
  },
  
  // OpenAI GPT-4.1
  'openai/gpt-4.1': {
    input: 2.50,
    output: 10.00,
  },
  'openai/gpt-4.1-mini': {
    input: 0.15,
    output: 0.60,
  },
  
  // OpenAI O-series (reasoning models)
  'openai/o3': {
    input: 10.00,
    output: 40.00,
  },
  'openai/o4-mini': {
    input: 1.10,
    output: 4.40,
  },
  
  // Google Gemini
  'google/gemini-2.5-pro': {
    input: 1.25,
    output: 5.00,
  },
  'google/gemini-2.5-flash': {
    input: 0.075,
    output: 0.30,
  },
  'google/gemini-2.5-flash-lite': {
    input: 0.015,
    output: 0.06,
  },
  
  // Anthropic Claude
  'anthropic/claude-opus-4': {
    input: 15.00,
    output: 75.00,
  },
  'anthropic/claude-sonnet-4': {
    input: 3.00,
    output: 15.00,
  },
  'anthropic/claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
  },
  'anthropic/claude-sonnet-4-5-20250929': {
    input: 3.00,
    output: 15.00,
  },
  'anthropic/claude-haiku-3': {
    input: 0.25,
    output: 1.25,
  },
} as const;

export type ModelName = keyof typeof MODEL_PRICING;

/**
 * Calculate cost for a request
 */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = MODEL_PRICING[model as ModelName];
  
  if (!pricing) {
    console.warn(`No pricing data for model: ${model}`);
    return 0;
  }
  
  const inputCost = (tokensIn / 1_000_000) * pricing.input;
  const outputCost = (tokensOut / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Track cost for a query
 */
export async function trackCost(
  supabase: SupabaseClient,
  data: {
    conversationId: string;
    userId: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    processingTimeMs: number;
    toolsCalled?: string[];
  }
): Promise<void> {
  const cost = calculateCost(data.model, data.tokensIn, data.tokensOut);
  
  try {
    // Update query_analytics with cost data
    const { error } = await supabase
      .from('query_analytics')
      .update({
        tokens_in: data.tokensIn,
        tokens_out: data.tokensOut,
        processing_time_ms: data.processingTimeMs,
        model_used: data.model,
        tools_called: data.toolsCalled || [],
      })
      .eq('conversation_id', data.conversationId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Failed to update cost tracking:', error);
    }
    
    // Log cost for monitoring
    console.log(JSON.stringify({
      event: 'llm_cost',
      conversationId: data.conversationId,
      userId: data.userId,
      model: data.model,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      cost: cost.toFixed(6),
      processingTimeMs: data.processingTimeMs,
    }));
  } catch (err) {
    console.error('Error tracking cost:', err);
  }
}

/**
 * Get cost summary for a user
 */
export async function getUserCostSummary(
  supabase: SupabaseClient,
  userId: string,
  daysBack: number = 30
): Promise<{
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  queryCount: number;
  costByModel: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from('query_analytics')
    .select('tokens_in, tokens_out, model_used')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());
  
  if (error || !data) {
    console.error('Failed to fetch cost summary:', error);
    return {
      totalCost: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      queryCount: 0,
      costByModel: {},
    };
  }
  
  let totalCost = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const costByModel: Record<string, number> = {};
  
  for (const row of data) {
    const tokensIn = row.tokens_in || 0;
    const tokensOut = row.tokens_out || 0;
    const model = row.model_used || 'unknown';
    
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    
    const cost = calculateCost(model, tokensIn, tokensOut);
    totalCost += cost;
    
    costByModel[model] = (costByModel[model] || 0) + cost;
  }
  
  return {
    totalCost,
    totalTokensIn,
    totalTokensOut,
    queryCount: data.length,
    costByModel,
  };
}
