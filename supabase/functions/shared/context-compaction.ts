/**
 * Context Compaction Service
 * Sprint 3: Context & Performance
 * 
 * Handles intelligent compression of conversation history to stay within token budgets
 */

import { estimateTokens } from './mode-strategy.ts';
import type { Message as LLMMessage } from './llm-router.ts';

export interface CompactionConfig {
  maxTokens: number;
  reserveForResponse: number;
  reserveForSystem: number;
  minMessagesToKeep: number;
  summaryThreshold: number;
}

export interface CompactionResult {
  messages: LLMMessage[];
  summary?: string;
  originalTokens: number;
  compactedTokens: number;
  compressionRatio: number;
  messagesRemoved: number;
}

const DEFAULT_CONFIG: CompactionConfig = {
  maxTokens: 8000,
  reserveForResponse: 2000,
  reserveForSystem: 500,
  minMessagesToKeep: 5,
  summaryThreshold: 15,
};

/**
 * Calculate total tokens in messages
 */
function calculateTotalTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + estimateTokens(content);
  }, 0);
}

/**
 * Summarize a batch of messages
 */
async function summarizeMessages(
  messages: LLMMessage[],
  lovableApiKey: string
): Promise<string> {
  // Build summary request
  const conversationText = messages
    .map(m => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `${m.role}: ${content}`;
    })
    .join('\n');

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'Sammanfatta följande konversation kortfattat. Behåll viktiga detaljer som artikelnummer, modeller och beslut. Skriv på svenska.',
          },
          {
            role: 'user',
            content: conversationText,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Failed to generate summary:', await response.text());
      return 'Tidigare diskussion om Volvo Amazon reservdelar.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Tidigare diskussion.';
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Tidigare konversation.';
  }
}

/**
 * Compact conversation history intelligently
 */
export async function compactHistory(
  messages: LLMMessage[],
  config: Partial<CompactionConfig> = {},
  lovableApiKey?: string
): Promise<CompactionResult> {
  try {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const originalTokens = calculateTotalTokens(messages);

    // If under budget, no compaction needed
    const availableTokens = cfg.maxTokens - cfg.reserveForResponse - cfg.reserveForSystem;
    if (originalTokens <= availableTokens) {
      return {
        messages,
        originalTokens,
        compactedTokens: originalTokens,
        compressionRatio: 1.0,
        messagesRemoved: 0,
      };
    }

    // Separate system messages from conversation
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // If conversation is short, just keep recent messages
    if (conversationMessages.length <= cfg.summaryThreshold) {
      // Simple truncation - keep most recent messages
      const recentMessages = conversationMessages.slice(-cfg.minMessagesToKeep);
      const compacted = [...systemMessages, ...recentMessages];
      const compactedTokens = calculateTotalTokens(compacted);

      return {
        messages: compacted,
        originalTokens,
        compactedTokens,
        compressionRatio: compactedTokens / originalTokens,
        messagesRemoved: conversationMessages.length - recentMessages.length,
      };
    }

    // For longer conversations, summarize older messages
    const recentCount = cfg.minMessagesToKeep;
    const recentMessages = conversationMessages.slice(-recentCount);
    const olderMessages = conversationMessages.slice(0, -recentCount);

    let summary: string | undefined;
    let compactedConversation: LLMMessage[] = [];

    // Generate summary if API key available
    if (lovableApiKey && olderMessages.length > 0) {
      try {
        summary = await summarizeMessages(olderMessages, lovableApiKey);
        
        // Add summary as system message
        compactedConversation = [
          ...systemMessages,
          {
            role: 'system',
            content: `

=== TIDIGARE KONVERSATION (SAMMANFATTAD) ===
${summary}
`,
          },
          ...recentMessages,
        ];
      } catch (error) {
        console.error('❌ Summary generation failed, using fallback truncation:', error);
        // Fallback: just keep recent messages
        compactedConversation = [...systemMessages, ...recentMessages];
      }
    } else {
      // Fallback: just keep recent messages
      compactedConversation = [...systemMessages, ...recentMessages];
    }

    const compactedTokens = calculateTotalTokens(compactedConversation);

    return {
      messages: compactedConversation,
      summary,
      originalTokens,
      compactedTokens,
      compressionRatio: compactedTokens / originalTokens,
      messagesRemoved: olderMessages.length,
    };
  } catch (error) {
    console.error('❌ compactHistory failed completely, using simple truncation:', error);
    
    // Ultimate fallback: just keep last N messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    const recentMessages = conversationMessages.slice(-5);
    const fallbackMessages = [...systemMessages, ...recentMessages];
    const fallbackTokens = calculateTotalTokens(fallbackMessages);
    
    return {
      messages: fallbackMessages,
      originalTokens: calculateTotalTokens(messages),
      compactedTokens: fallbackTokens,
      compressionRatio: fallbackTokens / calculateTotalTokens(messages),
      messagesRemoved: conversationMessages.length - recentMessages.length,
    };
  }
}

/**
 * Adaptive topK based on query complexity
 */
export function calculateAdaptiveTopK(
  query: string,
  baseTopK: number = 3,
  maxTopK: number = 10
): number {
  // Factors that increase topK:
  // 1. Query length (longer = more complex)
  // 2. Question marks (multiple questions)
  // 3. Technical terms
  // 4. "jämför", "skillnad", etc. (comparison queries)

  let topK = baseTopK;

  // Query length bonus
  const words = query.split(/\s+/).length;
  if (words > 20) topK += 2;
  else if (words > 10) topK += 1;

  // Multiple questions bonus
  const questionMarks = (query.match(/\?/g) || []).length;
  if (questionMarks > 1) topK += 1;

  // Comparison keywords
  const comparisonKeywords = ['jämför', 'skillnad', 'bättre', 'vs', 'eller', 'mellan'];
  if (comparisonKeywords.some(kw => query.toLowerCase().includes(kw))) {
    topK += 2;
  }

  // Technical terms (artikelnummer, specifikationer, etc.)
  const technicalTerms = ['artikelnummer', 'specifikation', 'spec', 'mått', 'vikt', 'material'];
  if (technicalTerms.some(term => query.toLowerCase().includes(term))) {
    topK += 1;
  }

  // Cap at maximum
  return Math.min(topK, maxTopK);
}

/**
 * Calculate token budget for different components
 */
export interface TokenBudget {
  total: number;
  system: number;
  history: number;
  response: number;
  tools: number;
}

export function calculateTokenBudget(
  maxTokens: number = 8000,
  mode: 'fast' | 'auto' | 'extended' = 'auto'
): TokenBudget {
  switch (mode) {
    case 'fast':
      return {
        total: maxTokens,
        system: 300,
        history: 2000,
        response: 500,
        tools: 200,
      };
    
    case 'extended':
      return {
        total: maxTokens,
        system: 600,
        history: 4000,
        response: 2000,
        tools: 400,
      };
    
    default: // 'auto'
      return {
        total: maxTokens,
        system: 400,
        history: 3000,
        response: 1000,
        tools: 300,
      };
  }
}

/**
 * Estimate if context will fit within budget
 */
export function willFitInBudget(
  messages: LLMMessage[],
  budget: TokenBudget
): {
  fits: boolean;
  currentTokens: number;
  availableTokens: number;
  exceedsBy: number;
} {
  const currentTokens = calculateTotalTokens(messages);
  const availableTokens = budget.total - budget.response - budget.tools;
  const fits = currentTokens <= availableTokens;
  const exceedsBy = fits ? 0 : currentTokens - availableTokens;

  return {
    fits,
    currentTokens,
    availableTokens,
    exceedsBy,
  };
}
