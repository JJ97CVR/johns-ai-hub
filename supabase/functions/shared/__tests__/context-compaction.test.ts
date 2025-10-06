/**
 * Unit Tests for Context Compaction
 * Sprint 3: Context & Performance
 */

import { assertEquals, assert } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import { 
  calculateAdaptiveTopK,
  calculateTokenBudget,
  willFitInBudget,
} from '../context-compaction.ts';
import type { Message as LLMMessage } from '../llm-router.ts';

Deno.test('calculateAdaptiveTopK - base case', () => {
  const topK = calculateAdaptiveTopK('Vad kostar bromsar?', 3, 10);
  assertEquals(topK, 3, 'Simple query should use base topK');
});

Deno.test('calculateAdaptiveTopK - long query increases topK', () => {
  const longQuery = 'Jag behöver information om vilka artikelnummer som finns för främre bromsskivor till Volvo Amazon 121 från 1965 och vad priset är';
  const topK = calculateAdaptiveTopK(longQuery, 3, 10);
  assert(topK > 3, 'Long query should increase topK');
});

Deno.test('calculateAdaptiveTopK - multiple questions increase topK', () => {
  const topK = calculateAdaptiveTopK('Vad kostar bromsar? Finns de i lager? När kan jag hämta?', 3, 10);
  assert(topK > 3, 'Multiple questions should increase topK');
});

Deno.test('calculateAdaptiveTopK - comparison queries increase topK', () => {
  const topK = calculateAdaptiveTopK('Vad är skillnaden mellan OEM och aftermarket bromsar?', 3, 10);
  assert(topK > 3, 'Comparison queries should increase topK');
});

Deno.test('calculateAdaptiveTopK - technical terms increase topK', () => {
  const topK = calculateAdaptiveTopK('Vilka specifikationer har artikelnummer 123456?', 3, 10);
  assert(topK > 3, 'Technical terms should increase topK');
});

Deno.test('calculateAdaptiveTopK - respects maxTopK', () => {
  const veryComplexQuery = 'Jag behöver jämföra specifikationerna mellan artikelnummer 123 och 456? Vad är skillnaden? Vilket är bättre? Finns de i lager?';
  const topK = calculateAdaptiveTopK(veryComplexQuery, 3, 8);
  assert(topK <= 8, 'Should not exceed maxTopK');
});

Deno.test('calculateTokenBudget - fast mode', () => {
  const budget = calculateTokenBudget(8000, 'fast');
  
  assertEquals(budget.total, 8000);
  assertEquals(budget.system, 300);
  assertEquals(budget.history, 2000);
  assertEquals(budget.response, 500);
  assertEquals(budget.tools, 200);
});

Deno.test('calculateTokenBudget - auto mode', () => {
  const budget = calculateTokenBudget(8000, 'auto');
  
  assertEquals(budget.total, 8000);
  assertEquals(budget.system, 400);
  assertEquals(budget.history, 3000);
  assertEquals(budget.response, 1000);
  assertEquals(budget.tools, 300);
});

Deno.test('calculateTokenBudget - extended mode', () => {
  const budget = calculateTokenBudget(8000, 'extended');
  
  assertEquals(budget.total, 8000);
  assertEquals(budget.system, 600);
  assertEquals(budget.history, 4000);
  assertEquals(budget.response, 2000);
  assertEquals(budget.tools, 400);
});

Deno.test('willFitInBudget - fits within budget', () => {
  const messages: LLMMessage[] = [
    { role: 'system', content: 'Short system message' },
    { role: 'user', content: 'Short user message' },
    { role: 'assistant', content: 'Short assistant response' },
  ];
  
  const budget = calculateTokenBudget(8000, 'auto');
  const result = willFitInBudget(messages, budget);
  
  assertEquals(result.fits, true);
  assertEquals(result.exceedsBy, 0);
  assert(result.currentTokens > 0, 'Should calculate tokens');
  assert(result.availableTokens > 0, 'Should calculate available tokens');
});

Deno.test('willFitInBudget - exceeds budget', () => {
  const longContent = 'Lorem ipsum '.repeat(1000); // ~2000 tokens
  const messages: LLMMessage[] = Array(10).fill(null).map((_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: longContent,
  }));
  
  const budget = calculateTokenBudget(8000, 'fast');
  const result = willFitInBudget(messages, budget);
  
  assertEquals(result.fits, false);
  assert(result.exceedsBy > 0, 'Should calculate how much it exceeds by');
  assert(result.currentTokens > result.availableTokens, 'Current should exceed available');
});
