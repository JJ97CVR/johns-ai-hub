/**
 * Unit Tests for Prompt Builder V1
 * Sprint 2: Prompts & Tool Logic
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import { buildPromptV1 } from '../index.ts';

Deno.test('buildPromptV1 - includes base template', () => {
  const prompt = buildPromptV1({});
  assertStringIncludes(prompt, 'Du är Lex');
  assertStringIncludes(prompt, 'Volvo Amazon');
});

Deno.test('buildPromptV1 - adds fast mode instructions', () => {
  const prompt = buildPromptV1({ mode: 'fast' });
  assertStringIncludes(prompt, 'Snabb-läge Aktiverat');
  assertStringIncludes(prompt, 'Prioritera hastighet');
});

Deno.test('buildPromptV1 - adds auto mode instructions', () => {
  const prompt = buildPromptV1({ mode: 'auto' });
  assertStringIncludes(prompt, 'Auto-läge Aktiverat');
  assertStringIncludes(prompt, 'Balansera hastighet');
});

Deno.test('buildPromptV1 - adds extended mode instructions', () => {
  const prompt = buildPromptV1({ mode: 'extended' });
  assertStringIncludes(prompt, 'Utökat-läge Aktiverat');
  assertStringIncludes(prompt, 'Prioritera noggrannhet');
});

Deno.test('buildPromptV1 - formats thread memory', () => {
  const prompt = buildPromptV1({ 
    threadSummary: 'User asked about Volvo Amazon brakes' 
  });
  assertStringIncludes(prompt, 'Konversationshistorik');
  assertStringIncludes(prompt, 'User asked about Volvo Amazon brakes');
});

Deno.test('buildPromptV1 - formats entities', () => {
  const prompt = buildPromptV1({ 
    entities: {
      parts: ['123456', '789012'],
      models: ['Amazon 121', 'Amazon 122'],
    }
  });
  assertStringIncludes(prompt, 'Identifierade Enheter');
  assertStringIncludes(prompt, '123456');
  assertStringIncludes(prompt, 'Amazon 121');
});

Deno.test('buildPromptV1 - formats org facts', () => {
  const prompt = buildPromptV1({ 
    orgFacts: [
      { key: 'Öppettider', value: 'Mån-Fre 08-17', description: 'Kundtjänst' },
      { key: 'Support', value: 'support@lex.se' },
    ]
  });
  assertStringIncludes(prompt, 'Organisationsinformation');
  assertStringIncludes(prompt, 'Öppettider');
  assertStringIncludes(prompt, 'support@lex.se');
});

Deno.test('buildPromptV1 - includes version metadata', () => {
  const prompt = buildPromptV1({});
  assertStringIncludes(prompt, 'Prompt Version: v1');
  assertStringIncludes(prompt, 'Last Updated:');
});

Deno.test('buildPromptV1 - combines all sections', () => {
  const prompt = buildPromptV1({
    mode: 'auto',
    threadSummary: 'Previous discussion about brakes',
    entities: { parts: ['123456'] },
    orgFacts: [{ key: 'Phone', value: '08-123456' }],
  });
  
  // All sections should be present
  assertStringIncludes(prompt, 'Du är Lex');
  assertStringIncludes(prompt, 'Auto-läge');
  assertStringIncludes(prompt, 'Konversationshistorik');
  assertStringIncludes(prompt, 'Identifierade Enheter');
  assertStringIncludes(prompt, 'Organisationsinformation');
  assertStringIncludes(prompt, 'Prompt Version: v1');
});
