/**
 * Prompt Manager - Multi-version Support
 * Sprint 2: Structured Prompts
 * 
 * Handles version selection and A/B testing
 */

import { buildPromptV1, type PromptBuilderOptions, VERSION as V1_VERSION } from './versions/v1/index.ts';

export type PromptVersion = 'v1' | 'v2' | 'latest';

export interface PromptConfig {
  version: PromptVersion;
  options: PromptBuilderOptions;
}

/**
 * Build system prompt with version support
 */
export function buildSystemPrompt(config: PromptConfig): string {
  const { version, options } = config;

  // Resolve 'latest' to actual version
  const resolvedVersion = version === 'latest' ? 'v1' : version;

  switch (resolvedVersion) {
    case 'v1':
      return buildPromptV1(options);
    
    // Future versions can be added here
    // case 'v2':
    //   return buildPromptV2(options);
    
    default:
      console.warn(`Unknown prompt version: ${version}, falling back to v1`);
      return buildPromptV1(options);
  }
}

/**
 * Get current prompt version
 */
export function getCurrentVersion(): string {
  return V1_VERSION;
}

/**
 * A/B testing: Select prompt version based on user ID
 * 50/50 split between v1 and v2 (when v2 is available)
 */
export function selectVersionForUser(userId: string): PromptVersion {
  // For now, always return v1
  // When v2 is ready, use hash-based splitting:
  // const hash = hashString(userId);
  // return hash % 2 === 0 ? 'v1' : 'v2';
  
  return 'v1';
}

/**
 * Get all available versions
 */
export function getAvailableVersions(): PromptVersion[] {
  return ['v1', 'latest'];
}
