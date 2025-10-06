import { describe, it, expect } from 'vitest';
import { MODEL_CONFIG, ALL_MODELS, DEFAULT_FALLBACK_MODELS, isValidModel, getProviderFromModel } from '../models-config.ts';

describe('models-config', () => {
  describe('MODEL_CONFIG', () => {
    it('should have OpenAI models', () => {
      expect(MODEL_CONFIG.OPENAI).toBeDefined();
      expect(MODEL_CONFIG.OPENAI.length).toBeGreaterThan(0);
      expect(MODEL_CONFIG.OPENAI).toContain('openai/gpt-5');
      expect(MODEL_CONFIG.OPENAI).toContain('openai/gpt-5-mini');
    });

    it('should have Anthropic models', () => {
      expect(MODEL_CONFIG.ANTHROPIC).toBeDefined();
      expect(MODEL_CONFIG.ANTHROPIC.length).toBeGreaterThan(0);
      expect(MODEL_CONFIG.ANTHROPIC).toContain('anthropic/claude-sonnet-4-20250514');
    });

    it('should have Google models', () => {
      expect(MODEL_CONFIG.GOOGLE).toBeDefined();
      expect(MODEL_CONFIG.GOOGLE.length).toBeGreaterThan(0);
      expect(MODEL_CONFIG.GOOGLE).toContain('google/gemini-2.5-flash');
    });
  });

  describe('ALL_MODELS', () => {
    it('should contain all provider models', () => {
      expect(ALL_MODELS).toBeDefined();
      expect(ALL_MODELS.length).toBeGreaterThan(0);
      
      // Check it contains models from all providers
      const hasOpenAI = ALL_MODELS.some(m => m.startsWith('openai/'));
      const hasAnthropic = ALL_MODELS.some(m => m.startsWith('anthropic/'));
      const hasGoogle = ALL_MODELS.some(m => m.startsWith('google/'));
      
      expect(hasOpenAI).toBe(true);
      expect(hasAnthropic).toBe(true);
      expect(hasGoogle).toBe(true);
    });

    it('should not have duplicates', () => {
      const uniqueModels = new Set(ALL_MODELS);
      expect(uniqueModels.size).toBe(ALL_MODELS.length);
    });
  });

  describe('DEFAULT_FALLBACK_MODELS', () => {
    it('should have fallback models', () => {
      expect(DEFAULT_FALLBACK_MODELS).toBeDefined();
      expect(DEFAULT_FALLBACK_MODELS.length).toBeGreaterThan(0);
    });

    it('should contain valid models', () => {
      DEFAULT_FALLBACK_MODELS.forEach(model => {
        expect(ALL_MODELS).toContain(model);
      });
    });
  });

  describe('isValidModel', () => {
    it('should return true for valid models', () => {
      expect(isValidModel('openai/gpt-5')).toBe(true);
      expect(isValidModel('anthropic/claude-sonnet-4-20250514')).toBe(true);
      expect(isValidModel('google/gemini-2.5-flash')).toBe(true);
    });

    it('should return false for invalid models', () => {
      expect(isValidModel('openai/gpt-999')).toBe(false);
      expect(isValidModel('unknown/model')).toBe(false);
      expect(isValidModel('invalid')).toBe(false);
      expect(isValidModel('')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isValidModel('OpenAI/GPT-5')).toBe(false);
      expect(isValidModel('OPENAI/gpt-5')).toBe(false);
    });
  });

  describe('getProviderFromModel', () => {
    it('should extract provider from OpenAI models', () => {
      expect(getProviderFromModel('openai/gpt-5')).toBe('openai');
      expect(getProviderFromModel('openai/gpt-5-mini')).toBe('openai');
    });

    it('should extract provider from Anthropic models', () => {
      expect(getProviderFromModel('anthropic/claude-sonnet-4-20250514')).toBe('anthropic');
    });

    it('should extract provider from Google models', () => {
      expect(getProviderFromModel('google/gemini-2.5-flash')).toBe('google');
    });

    it('should return empty string for invalid format', () => {
      expect(getProviderFromModel('invalid-model')).toBe('');
      expect(getProviderFromModel('')).toBe('');
    });
  });
});
