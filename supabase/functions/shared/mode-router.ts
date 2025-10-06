/**
 * Mode Router - Conditional Execution Strategy
 * Phase 3: Skip unnecessary operations based on chat mode and query complexity
 * 
 * Fast mode: Skip everything (RAG, memory, tools, entity extraction)
 * Auto mode (simple): Skip some operations
 * Auto mode (complex): Use all features
 * Extended mode: Use all features with higher limits
 */

import type { ChatMode } from './mode-strategy.ts';
import { logInfo } from './logger-utils.ts';

export type ExecutionStrategy = 'minimal' | 'balanced' | 'comprehensive';

export interface StrategyConfig {
  skipRAG: boolean;
  skipMemory: boolean;
  skipTools: boolean;
  skipEntityExtraction: boolean;
  skipCache: boolean;
  maxIterations: number;
  timeoutMs: number;
  ragTopK: number;
}

/**
 * Determine execution strategy based on mode and query
 */
export function getExecutionStrategy(mode: ChatMode, message: string): ExecutionStrategy {
  // MINIMAL: Fast mode - skip everything possible
  if (mode === 'fast') {
    logInfo('mode-router', 'Using minimal strategy for fast mode');
    return 'minimal';
  }
  
  // Check query complexity for auto mode
  const isSimpleQuery = isQuerySimple(message);
  
  if (mode === 'auto' && isSimpleQuery) {
    logInfo('mode-router', 'Using minimal strategy for simple auto query', {
      messageLength: message.length,
    });
    return 'minimal';
  }
  
  // COMPREHENSIVE: Extended mode - use everything
  if (mode === 'extended') {
    logInfo('mode-router', 'Using comprehensive strategy for extended mode');
    return 'comprehensive';
  }
  
  // BALANCED: Auto mode with complex query
  logInfo('mode-router', 'Using balanced strategy', { mode });
  return 'balanced';
}

/**
 * Analyze query to determine if it's simple enough to skip expensive operations
 */
function isQuerySimple(message: string): boolean {
  const length = message.length;
  const hasComplexKeywords = /search|latest|news|find|analyze|compare|explain|detail|comprehensive|research/i.test(message);
  const hasQuestionWords = /what|when|where|why|how|who|which/i.test(message);
  const hasMultipleSentences = (message.match(/[.!?]+/g) || []).length > 2;
  
  // Simple = short, no complex keywords, not too many questions
  return length < 100 && !hasComplexKeywords && !hasMultipleSentences;
}

/**
 * Get configuration for execution strategy
 */
export function getStrategyConfig(strategy: ExecutionStrategy, mode: ChatMode): StrategyConfig {
  switch (strategy) {
    case 'minimal':
      return {
        skipRAG: true,
        skipMemory: true,
        skipTools: true,
        skipEntityExtraction: true,
        skipCache: mode === 'fast', // Fast mode should also skip cache check
        maxIterations: 1,
        timeoutMs: 5000,
        ragTopK: 0,
      };
    
    case 'balanced':
      return {
        skipRAG: false,
        skipMemory: false,
        skipTools: false,
        skipEntityExtraction: false,
        skipCache: false,
        maxIterations: 2,
        timeoutMs: 15000,
        ragTopK: 5,
      };
    
    case 'comprehensive':
      return {
        skipRAG: false,
        skipMemory: false,
        skipTools: true,
        skipEntityExtraction: false,
        skipCache: false,
        maxIterations: 5,
        timeoutMs: 60000,
        ragTopK: 10,
      };
  }
}

/**
 * Log strategy decision for observability
 */
export function logStrategyDecision(
  strategy: ExecutionStrategy,
  config: StrategyConfig,
  mode: ChatMode,
  message: string
) {
  logInfo('mode-router', 'Execution strategy determined', {
    strategy,
    mode,
    messageLength: message.length,
    skipping: {
      rag: config.skipRAG,
      memory: config.skipMemory,
      tools: config.skipTools,
      entityExtraction: config.skipEntityExtraction,
      cache: config.skipCache,
    },
    limits: {
      maxIterations: config.maxIterations,
      timeoutMs: config.timeoutMs,
      ragTopK: config.ragTopK,
    },
  });
}
