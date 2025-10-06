/**
 * Smart Model Router
 * Phase 3: Performance Optimization
 * 
 * Dynamically selects the optimal AI model based on query complexity.
 * Routes simple queries to fast models, complex queries to powerful models.
 */

import { logInfo, logDebug } from './logger-utils.ts';
import { ALL_MODELS } from './models-config.ts';

export interface QueryAnalysis {
  complexity: 'trivial' | 'simple' | 'medium' | 'complex';
  recommendedModel: string;
  confidence: number;
  reasoning: string;
}

/**
 * Analyze query complexity and recommend optimal model
 */
export function analyzeQueryComplexity(
  message: string,
  requestId: string
): QueryAnalysis {
  const length = message.length;
  const wordCount = message.split(/\s+/).length;
  const hasPartNumber = /\d{5,}/.test(message);
  const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;
  
  // Complex keywords that require deeper reasoning
  const complexKeywords = /jämför|analysera|förklara|utred|research|compare|analyze|explain|investigate|detail|utvärdera|evaluate/i;
  const hasComplexKeywords = complexKeywords.test(message);
  
  // Simple lookup keywords
  const simpleKeywords = /pris|kostar|tillgänglighet|finns|hej|tack|ok|price|cost|available|hello|thanks/i;
  const hasSimpleKeywords = simpleKeywords.test(message);

  logDebug('smart-router', 'Analyzing query complexity', {
    requestId,
    length,
    wordCount,
    hasPartNumber,
    hasComplexKeywords,
    hasSimpleKeywords,
  });

  // TRIVIAL: Very short greetings or acknowledgments
  if (length < 30 && !hasPartNumber && hasSimpleKeywords) {
    return {
      complexity: 'trivial',
      recommendedModel: 'google/gemini-2.5-flash-lite',
      confidence: 0.95,
      reasoning: 'Short greeting or simple acknowledgment',
    };
  }

  // SIMPLE: Direct part number lookup or simple questions
  if (length < 100 && hasPartNumber && !hasComplexKeywords && !hasMultipleQuestions) {
    return {
      complexity: 'simple',
      recommendedModel: 'google/gemini-2.5-flash',
      confidence: 0.90,
      reasoning: 'Simple part number lookup or single straightforward question',
    };
  }

  // COMPLEX: Multiple questions, complex keywords, or long detailed queries
  if (
    hasComplexKeywords ||
    hasMultipleQuestions ||
    length > 300 ||
    wordCount > 50
  ) {
    return {
      complexity: 'complex',
      recommendedModel: 'google/gemini-2.5-pro',
      confidence: 0.85,
      reasoning: 'Complex analysis, comparison, or detailed explanation required',
    };
  }

  // MEDIUM: Default for average queries
  return {
    complexity: 'medium',
    recommendedModel: 'google/gemini-2.5-flash',
    confidence: 0.80,
    reasoning: 'Standard query requiring moderate reasoning',
  };
}

/**
 * Select optimal model, falling back to user's choice if provided
 */
export function selectOptimalModel(
  userSelectedModel: string | undefined,
  queryMessage: string,
  requestId: string
): { model: string; analysis: QueryAnalysis | null } {
  // User explicitly chose a model - respect their choice
  if (userSelectedModel) {
    logInfo('smart-router', 'Using user-selected model', {
      requestId,
      model: userSelectedModel,
    });
    return {
      model: userSelectedModel,
      analysis: null,
    };
  }

  // Smart routing: analyze query and choose optimal model
  const analysis = analyzeQueryComplexity(queryMessage, requestId);

  logInfo('smart-router', 'Smart model routing', {
    requestId,
    complexity: analysis.complexity,
    selectedModel: analysis.recommendedModel,
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
  });

  return {
    model: analysis.recommendedModel,
    analysis,
  };
}

/**
 * Get expected latency range for a model
 */
export function getModelLatency(model: string): { min: number; max: number } {
  if (model.includes('flash-lite')) {
    return { min: 200, max: 800 };
  }
  if (model.includes('flash')) {
    return { min: 500, max: 2000 };
  }
  if (model.includes('pro') || model.includes('gpt-5')) {
    return { min: 2000, max: 8000 };
  }
  // Default
  return { min: 1000, max: 5000 };
}

/**
 * Validate that the selected model is supported
 */
export function isValidModel(model: string): boolean {
  return ALL_MODELS.includes(model as any);
}
