/**
 * Chat Mode Strategy
 * Maps chat modes to specific model configurations and policies
 * Sprint 2: Integrated with Tool Intelligence
 */

import { isVolvoPartNumber } from './parts.ts';
import { getModeDeadline } from './timeouts-config.ts';
import { smartNeedsTools, getCachedToolDecision } from './tool-intelligence.ts';

import { encoding_for_model } from 'npm:tiktoken@1.0.22';

/**
 * Token estimation using tiktoken library
 * Provides accurate token counting for GPT models
 */

// Cache encoding to avoid repeated initialization
let cachedEncoding: any = null;

/**
 * Accurate token estimation using tiktoken
 */
export function estimateTokens(text: string, model: string = 'gpt-4'): number {
  if (!text) return 0;
  
  try {
    // Lazy load encoding (only once)
    if (!cachedEncoding) {
      cachedEncoding = encoding_for_model('gpt-4');
    }
    
    const tokens = cachedEncoding.encode(text);
    return tokens.length;
  } catch (error) {
    console.warn('Failed to use tiktoken, falling back to heuristic', error);
    return estimateTokensHeuristic(text);
  }
}

/**
 * Fallback heuristic estimation (used if tiktoken fails)
 */
function estimateTokensHeuristic(text: string): number {
  if (!text) return 0;
  
  const words = text.split(/[\s,\.!?;:()\[\]{}]+/).filter(Boolean);
  let tokens = words.length * 1.3;
  
  const punctuation = (text.match(/[,\.!?;:()\[\]{}'"]/g) || []).length;
  tokens += punctuation * 0.5;
  
  const numbers = (text.match(/\d+/g) || []).length;
  tokens += numbers * 0.3;
  
  const longWords = words.filter(w => w.length > 12).length;
  tokens += longWords * 0.8;
  
  return Math.ceil(tokens);
}

/**
 * Cleanup function for tiktoken encoder
 */
export function cleanupTokenEncoder() {
  if (cachedEncoding) {
    cachedEncoding.free();
    cachedEncoding = null;
  }
}

export type ChatMode = 'fast' | 'auto' | 'extended';

export interface ModeStrategy {
  provider: 'openai' | 'anthropic' | 'lovable-ai';
  model: string;
  allowTools: boolean;
  topK: number; // RAG results to retrieve
  maxTokens: number;
  temperature: number;
  deadlineMs: number;
}

/**
 * Get strategy configuration for a given mode
 */
export function strategyFor(mode: ChatMode): ModeStrategy {
  switch (mode) {
    case 'fast':
      return {
        provider: 'openai',
        model: 'openai/gpt-5-mini',
        allowTools: false,
        topK: 2,
        maxTokens: 500,
        temperature: 0.3,
        deadlineMs: getModeDeadline('fast'),
      };

    case 'extended':
      return {
        provider: 'anthropic',
        model: 'anthropic/claude-sonnet-4-5-20250929',
        allowTools: true,
        topK: 8,
        maxTokens: 2000,
        temperature: 0.2,
        deadlineMs: getModeDeadline('extended'),
      };

    default: // 'auto'
      return {
        provider: 'openai',
        model: 'openai/gpt-5-mini',
        allowTools: true,
        topK: 3,
        maxTokens: 1000,
        temperature: 0.25,
        deadlineMs: getModeDeadline('auto'),
      };
  }
}

/**
 * Heuristic to determine if a query needs tools (for auto mode)
 * Sprint 2: Enhanced with Tool Intelligence
 * 
 * This is now a wrapper around the smart tool decision system
 */
export function needsTools(query: string, mode: ChatMode = 'auto'): boolean {
  // Use cached smart decision
  const decision = getCachedToolDecision(query, mode);
  
  // Log decision for debugging
  if (decision.needsTools) {
    console.log(`🎯 Tools recommended (confidence: ${(decision.confidence * 100).toFixed(1)}%):`, decision.recommendedTools);
  } else {
    console.log('🚫 No tools needed for this query');
  }
  
  return decision.needsTools;
}

/**
 * Deadline controller - wraps promise with timeout
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  deadlineMs: number,
  errorMessage: string = 'Request deadline exceeded'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), deadlineMs)
  );
  
  return Promise.race([promise, timeout]);
}

type ChatMessage = { role: "system"|"user"|"assistant"|"tool"; content: string };

/**
 * FIX P0: Trim conversation history to stay within token budget
 * Uses improved character-based estimation (no WASM dependencies)
 */
export function trimHistory(
  systemMessages: ChatMessage[],
  history: ChatMessage[],
  {
    maxTokens = 8000,
    model = "gpt-4o",
    reserveForResponse = 1024,
    reserveForTools = 256,
  }: {
    maxTokens?: number;
    model?: string;
    reserveForResponse?: number;
    reserveForTools?: number;
  } = {}
) {
  const count = (s: string) => estimateTokens(s ?? "");

  // 1) Calculate budget after system + reserves
  let budget = maxTokens - reserveForResponse - reserveForTools;
  const sysTokens = systemMessages.reduce((acc, m) => acc + count(m.content), 0);
  budget -= sysTokens;
  
  if (budget <= 0) {
    // System prompt alone exceeds budget - trim system hard
    let trimmedSys: ChatMessage[] = [];
    let used = 0;
    for (const m of systemMessages) {
      const t = count(m.content);
      if (used + t > maxTokens - reserveForResponse) break;
      trimmedSys.push(m);
      used += t;
    }
    console.warn(`⚠️ System prompt trimmed: ${systemMessages.length} → ${trimmedSys.length} messages`);
    return { system: trimmedSys, history: [] as ChatMessage[] };
  }

  // 2) Add history backwards until budget exhausted
  const kept: ChatMessage[] = [];
  let usedHist = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const t = count(msg.content);
    if (usedHist + t > budget) break;
    kept.push(msg);
    usedHist += t;
  }
  kept.reverse();

  console.log(`📊 Token budget: system=${sysTokens}, history=${usedHist}/${budget}, kept=${kept.length}/${history.length} msgs`);
  return { system: systemMessages, history: kept };
}
