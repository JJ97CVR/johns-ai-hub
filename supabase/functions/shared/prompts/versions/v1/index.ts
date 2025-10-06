/**
 * Version 1 Prompt Builder
 * Sprint 2: Structured Prompts
 * 
 * Exports the complete prompt builder for v1
 */

import { BASE_SYSTEM_PROMPT, VERSION, LAST_UPDATED } from './base-template.ts';
import { MODE_PROMPTS, type ChatMode } from './modes.ts';
import { formatThreadMemory, formatEntities, formatOrgFacts } from './memory-context.ts';

export interface PromptBuilderOptions {
  mode?: ChatMode;
  threadSummary?: string;
  entities?: Record<string, string[]>;
  orgFacts?: Array<{ key: string; value: string; description?: string }>;
}

/**
 * Build complete system prompt for v1
 */
export function buildPromptV1(options: PromptBuilderOptions = {}): string {
  const {
    mode = 'auto',
    threadSummary = '',
    entities = {},
    orgFacts = [],
  } = options;

  let prompt = BASE_SYSTEM_PROMPT;

  // Add mode-specific instructions
  const modePrompt = MODE_PROMPTS[mode];
  if (modePrompt) {
    prompt += '\n' + modePrompt;
  }

  // Add thread memory
  const memorySection = formatThreadMemory(threadSummary);
  if (memorySection) {
    prompt += '\n' + memorySection;
  }

  // Add entities
  const entitiesSection = formatEntities(entities);
  if (entitiesSection) {
    prompt += '\n' + entitiesSection;
  }

  // Add org facts
  const factsSection = formatOrgFacts(orgFacts);
  if (factsSection) {
    prompt += '\n' + factsSection;
  }

  // Add metadata footer
  prompt += `\n\n---
_Prompt Version: ${VERSION} | Last Updated: ${LAST_UPDATED}_`;

  return prompt;
}

export { VERSION, LAST_UPDATED };
export type { ChatMode };
