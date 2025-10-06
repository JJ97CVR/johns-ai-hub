/**
 * Tool Intelligence - Smart Tool Selection
 * Sprint 2: Enhanced Tool Logic
 * 
 * Uses embeddings and confidence scoring for intelligent tool triggering
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Tool trigger patterns with confidence thresholds
 */
export interface ToolPattern {
  tool: string;
  patterns: string[];
  keywords: string[];
  confidence: number;
  description: string;
}

export const TOOL_PATTERNS: ToolPattern[] = [
  {
    tool: 'web_search',
    patterns: [
      'sök',
      'googla',
      'leta efter',
      'hitta information',
      'vad säger',
      'senaste nytt',
      'aktuell',
      'idag',
      'nu',
      'nuläge',
      'var finns',
      'var sitter',
      'vart sitter',
      'placering',
      'monterad',
      'belägen',
      'position',
    ],
    keywords: ['sök', 'search', 'googla', 'leta', 'hitta', 'aktuell', 'idag', 'nu', 'senaste', 'var', 'vart', 'sitter', 'finns', 'placering', 'position'],
    confidence: 0.9,
    description: 'Web search for current information',
  },
  {
    tool: 'knowledge_base_search',
    patterns: [
      'artikelnummer',
      'reservdel',
      'volvo amazon',
      'specifikation',
      'manual',
      'katalog',
      'pris',
      'tillgänglighet',
      'beställning',
      'monteringsanvisning',
      'var finns',
      'var sitter',
      'vart sitter',
      'placering',
      'monterad',
      'position',
    ],
    keywords: ['artikelnummer', 'reservdel', 'volvo', 'amazon', 'spec', 'manual', 'pris', 'var', 'vart', 'sitter', 'finns', 'placering', 'position'],
    confidence: 0.95,
    description: 'Knowledge base search for internal data',
  },
  {
    tool: 'fetch_url',
    patterns: [
      'hämta från',
      'läs sidan',
      'kolla denna länk',
      'vad står på',
      'innehåll på',
    ],
    keywords: ['http://', 'https://', 'www.', '.com', '.se', 'länk', 'url', 'sida'],
    confidence: 0.85,
    description: 'Fetch content from specific URL',
  },
  {
    tool: 'create_artifact',
    patterns: [
      'skapa fil',
      'generera dokument',
      'exportera',
      'ladda ner',
      'spara som',
    ],
    keywords: ['skapa', 'generera', 'exportera', 'ladda', 'spara', 'fil', 'dokument'],
    confidence: 0.8,
    description: 'Create downloadable files',
  },
];

/**
 * Calculate confidence score for tool usage based on query
 */
export function calculateToolConfidence(query: string, pattern: ToolPattern): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;
  let matches = 0;

  // Check pattern matches
  for (const p of pattern.patterns) {
    if (lowerQuery.includes(p.toLowerCase())) {
      matches++;
      score += 1.0;
    }
  }

  // Check keyword matches
  for (const keyword of pattern.keywords) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      matches++;
      score += 0.5;
    }
  }

  // Normalize score (0-1 range)
  const normalizedScore = Math.min(score / 3, 1.0);

  // Apply base confidence multiplier
  return normalizedScore * pattern.confidence;
}

/**
 * Determine which tools should be used for a query
 */
export function recommendTools(query: string, threshold: number = 0.5): Array<{
  tool: string;
  confidence: number;
  reason: string;
}> {
  const recommendations: Array<{
    tool: string;
    confidence: number;
    reason: string;
  }> = [];

  for (const pattern of TOOL_PATTERNS) {
    const confidence = calculateToolConfidence(query, pattern);
    
    if (confidence >= threshold) {
      recommendations.push({
        tool: pattern.tool,
        confidence,
        reason: pattern.description,
      });
    }
  }

  // Sort by confidence (highest first)
  recommendations.sort((a, b) => b.confidence - a.confidence);

  return recommendations;
}

/**
 * Enhanced needsTools with confidence scoring
 * FAS 2: Part number intelligence integration
 */
export function smartNeedsTools(query: string, mode: string = 'auto'): {
  needsTools: boolean;
  recommendedTools: string[];
  confidence: number;
} {
  // FAS 2: SPECIAL CASE - Part number detection (6-7 digits) = ALWAYS use tools
  const partNumberMatch = query.match(/\b\d{6,7}\b/);
  if (partNumberMatch) {
    const hasLocationIntent = /var|vart|sitter|finns|placering|monterad|position/i.test(query);
    
    if (hasLocationIntent) {
      // Location query → Web search prioritized
      return {
        needsTools: true,
        recommendedTools: ['web_search', 'knowledge_base_search'],
        confidence: 0.95
      };
    } else {
      // Spec query → Knowledge base prioritized
      return {
        needsTools: true,
        recommendedTools: ['knowledge_base_search', 'web_search'],
        confidence: 0.9
      };
    }
  }
  
  // Fast mode never uses tools (unless part number detected above)
  if (mode === 'fast') {
    return { needsTools: false, recommendedTools: [], confidence: 0 };
  }

  // Extended mode always uses tools
  if (mode === 'extended') {
    const recs = recommendTools(query, 0.3); // Lower threshold for extended
    return {
      needsTools: true,
      recommendedTools: recs.map(r => r.tool),
      confidence: recs.length > 0 ? recs[0].confidence : 0.5,
    };
  }

  // Auto mode: intelligent decision
  const recommendations = recommendTools(query, 0.5);
  
  return {
    needsTools: recommendations.length > 0,
    recommendedTools: recommendations.map(r => r.tool),
    confidence: recommendations.length > 0 ? recommendations[0].confidence : 0,
  };
}

/**
 * Cache tool decisions for performance
 */
interface CachedDecision {
  query: string;
  decision: ReturnType<typeof smartNeedsTools>;
  timestamp: number;
}

const toolDecisionCache = new Map<string, CachedDecision>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

/**
 * Calculate semantic confidence using vector similarity (Sprint 4)
 * Falls back to pattern-based if embeddings unavailable
 */
export async function calculateSemanticConfidence(
  query: string,
  toolName: string,
  supabase: any
): Promise<number> {
  try {
    // Get query embedding using OpenAI
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      return 0; // Fallback to pattern matching
    }

    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingRes.ok) return 0;

    const embeddingData = await embeddingRes.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Find similar tool patterns using vector search
    const { data, error } = await supabase
      .from('tool_embeddings')
      .select('tool_name, embedding')
      .eq('tool_name', toolName)
      .limit(1);

    if (error || !data || data.length === 0) return 0;

    // Calculate cosine similarity (placeholder - actual implementation would compute it)
    return 0.5;
  } catch (error) {
    console.warn('Semantic matching error:', error);
    return 0;
  }
}

/**
 * Hybrid tool recommendation combining pattern + semantic matching (Sprint 4)
 */
export async function hybridToolRecommendation(
  query: string,
  supabase?: any,
  threshold: number = 0.5
): Promise<Array<{ tool: string; confidence: number; reason: string; method: string }>> {
  // Pattern-based confidence (existing)
  const patternResults = recommendTools(query, threshold);

  // Semantic confidence (new)
  const semanticResults: Array<{ tool: string; confidence: number; reason: string; method: string }> = [];
  
  if (supabase) {
    for (const pattern of TOOL_PATTERNS) {
      const semanticScore = await calculateSemanticConfidence(query, pattern.tool, supabase);
      if (semanticScore > threshold) {
        semanticResults.push({
          tool: pattern.tool,
          confidence: semanticScore,
          reason: `Semantic match: ${pattern.description}`,
          method: 'semantic'
        });
      }
    }
  }

  // Combine and deduplicate
  const combined = new Map<string, { confidence: number; reason: string; method: string }>();
  
  for (const result of patternResults) {
    combined.set(result.tool, {
      confidence: result.confidence,
      reason: result.reason,
      method: 'pattern'
    });
  }

  for (const result of semanticResults) {
    const existing = combined.get(result.tool);
    if (existing) {
      // Average pattern + semantic scores
      combined.set(result.tool, {
        confidence: (existing.confidence + result.confidence) / 2,
        reason: `${existing.reason} + ${result.reason}`,
        method: 'hybrid'
      });
    } else {
      combined.set(result.tool, result);
    }
  }

  return Array.from(combined.entries())
    .map(([tool, data]) => ({ tool, ...data }))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get tool decision with caching
 */
export function getCachedToolDecision(query: string, mode: string = 'auto'): ReturnType<typeof smartNeedsTools> {
  const cacheKey = `${query}_${mode}`;
  const cached = toolDecisionCache.get(cacheKey);

  // Check if cached and not expired
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.decision;
  }

  // Calculate new decision
  const decision = smartNeedsTools(query, mode);

  // Cache it
  toolDecisionCache.set(cacheKey, {
    query,
    decision,
    timestamp: Date.now(),
  });

  // Cleanup old entries (keep cache size reasonable)
  if (toolDecisionCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of toolDecisionCache.entries()) {
      if ((now - value.timestamp) > CACHE_TTL) {
        toolDecisionCache.delete(key);
      }
    }
  }

  return decision;
}

/**
 * Benchmark tool decision accuracy
 */
export async function benchmarkToolDecisions(
  supabase: SupabaseClient,
  limit: number = 100
): Promise<{
  totalQueries: number;
  correctDecisions: number;
  accuracy: number;
  falsePositives: number;
  falseNegatives: number;
}> {
  // Fetch recent queries with tools data
  const { data: queries } = await supabase
    .from('query_analytics')
    .select('query, tools_called')
    .not('tools_called', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!queries || queries.length === 0) {
    return {
      totalQueries: 0,
      correctDecisions: 0,
      accuracy: 0,
      falsePositives: 0,
      falseNegatives: 0,
    };
  }

  let correct = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const q of queries) {
    const actualUsedTools = q.tools_called || [];
    const decision = smartNeedsTools(q.query, 'auto');

    // Check if decision was correct
    if (actualUsedTools.length > 0 && decision.needsTools) {
      // Correctly identified need for tools
      correct++;
    } else if (actualUsedTools.length === 0 && !decision.needsTools) {
      // Correctly identified no need for tools
      correct++;
    } else if (actualUsedTools.length === 0 && decision.needsTools) {
      // False positive: recommended tools but none were used
      falsePositives++;
    } else if (actualUsedTools.length > 0 && !decision.needsTools) {
      // False negative: didn't recommend tools but they were used
      falseNegatives++;
    }
  }

  const accuracy = queries.length > 0 ? (correct / queries.length) * 100 : 0;

  return {
    totalQueries: queries.length,
    correctDecisions: correct,
    accuracy,
    falsePositives,
    falseNegatives,
  };
}
