/**
 * Centralized Model Configuration
 * Single source of truth for all supported AI models
 */

export const MODEL_CONFIG = {
  OPENAI: [
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'openai/gpt-5-nano',
    'openai/gpt-4.1',
    'openai/gpt-4.1-mini',
    'openai/o3',
    'openai/o4-mini',
    'gpt-4o',
    'gpt-4o-mini',
  ],
  ANTHROPIC: [
    'anthropic/claude-sonnet-4-20250514',
    'anthropic/claude-sonnet-4-5-20250929',
    'anthropic/claude-opus-4',
  ],
  GOOGLE: [
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'google/gemini-2.5-flash-lite',
  ],
} as const;

export const ALL_MODELS = [
  ...MODEL_CONFIG.OPENAI,
  ...MODEL_CONFIG.ANTHROPIC,
  ...MODEL_CONFIG.GOOGLE,
] as const;

export const DEFAULT_FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'openai/gpt-5-mini',
  'google/gemini-2.5-flash-lite',
] as const;

/**
 * Check if a model is valid
 */
export function isValidModel(model: string): boolean {
  return ALL_MODELS.includes(model as any);
}

/**
 * Get provider name from model string
 */
export function getProviderFromModel(model: string): string {
  if (model.startsWith('openai/') || model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('anthropic/') || model.includes('claude')) return 'anthropic';
  if (model.startsWith('google/') || model.includes('gemini')) return 'google';
  return 'unknown';
}
