/**
 * Unit Tests for Tool Intelligence
 * Sprint 2: Prompts & Tool Logic
 */

import { assertEquals, assert } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import { 
  calculateToolConfidence, 
  recommendTools, 
  smartNeedsTools,
  getCachedToolDecision,
  TOOL_PATTERNS 
} from '../tool-intelligence.ts';

Deno.test('calculateToolConfidence - web_search pattern matching', () => {
  const pattern = TOOL_PATTERNS.find(p => p.tool === 'web_search')!;
  
  const highConfidence = calculateToolConfidence('sök efter volvo amazon idag', pattern);
  const lowConfidence = calculateToolConfidence('berätta om volvo amazon', pattern);
  
  assert(highConfidence > 0.5, 'Should have high confidence for search query');
  assert(lowConfidence < 0.3, 'Should have low confidence for non-search query');
});

Deno.test('calculateToolConfidence - knowledge_base_search pattern matching', () => {
  const pattern = TOOL_PATTERNS.find(p => p.tool === 'knowledge_base_search')!;
  
  const highConfidence = calculateToolConfidence('artikelnummer för volvo amazon bromsar', pattern);
  const lowConfidence = calculateToolConfidence('vad är python?', pattern);
  
  assert(highConfidence > 0.6, 'Should have high confidence for part number query');
  assert(lowConfidence < 0.2, 'Should have low confidence for general question');
});

Deno.test('recommendTools - returns sorted by confidence', () => {
  const recs = recommendTools('sök artikelnummer för volvo amazon reservdelar');
  
  assert(recs.length > 0, 'Should recommend at least one tool');
  assert(recs[0].confidence >= (recs[1]?.confidence ?? 0), 'Should be sorted by confidence');
  
  // Should recommend both web_search and knowledge_base_search
  const tools = recs.map(r => r.tool);
  assert(tools.includes('web_search') || tools.includes('knowledge_base_search'), 
    'Should recommend search tools');
});

Deno.test('recommendTools - respects threshold', () => {
  const highThreshold = recommendTools('volvo amazon', 0.8);
  const lowThreshold = recommendTools('volvo amazon', 0.2);
  
  assert(highThreshold.length <= lowThreshold.length, 
    'Higher threshold should return fewer recommendations');
});

Deno.test('smartNeedsTools - fast mode never uses tools', () => {
  const result = smartNeedsTools('sök efter volvo amazon reservdelar', 'fast');
  
  assertEquals(result.needsTools, false);
  assertEquals(result.recommendedTools.length, 0);
  assertEquals(result.confidence, 0);
});

Deno.test('smartNeedsTools - extended mode always uses tools', () => {
  const result = smartNeedsTools('berätta om volvo amazon', 'extended');
  
  assertEquals(result.needsTools, true);
  assert(result.recommendedTools.length > 0, 'Should recommend tools in extended mode');
});

Deno.test('smartNeedsTools - auto mode intelligent decision', () => {
  const search = smartNeedsTools('sök efter senaste nytt om volvo', 'auto');
  const general = smartNeedsTools('vad är python?', 'auto');
  
  assertEquals(search.needsTools, true, 'Should use tools for search queries');
  assertEquals(general.needsTools, false, 'Should not use tools for general knowledge');
});

Deno.test('getCachedToolDecision - caches results', () => {
  const query = 'test query for caching';
  const mode = 'auto';
  
  const first = getCachedToolDecision(query, mode);
  const second = getCachedToolDecision(query, mode);
  
  // Should return same object (cached)
  assertEquals(first.needsTools, second.needsTools);
  assertEquals(first.confidence, second.confidence);
  assertEquals(first.recommendedTools, second.recommendedTools);
});

Deno.test('getCachedToolDecision - different modes have different cache', () => {
  const query = 'sök efter volvo';
  
  const fast = getCachedToolDecision(query, 'fast');
  const extended = getCachedToolDecision(query, 'extended');
  
  assertEquals(fast.needsTools, false, 'Fast should not use tools');
  assertEquals(extended.needsTools, true, 'Extended should use tools');
});

Deno.test('TOOL_PATTERNS - all tools have valid config', () => {
  for (const pattern of TOOL_PATTERNS) {
    assert(pattern.tool.length > 0, 'Tool name should not be empty');
    assert(pattern.patterns.length > 0, 'Should have at least one pattern');
    assert(pattern.keywords.length > 0, 'Should have at least one keyword');
    assert(pattern.confidence > 0 && pattern.confidence <= 1, 
      'Confidence should be between 0 and 1');
    assert(pattern.description.length > 0, 'Description should not be empty');
  }
});
