import { describe, it, expect } from 'vitest';
import { estimateTokens, strategyFor, needsTools, trimHistory } from '../mode-strategy.ts';

describe('mode-strategy', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'hello world';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(1);
      expect(tokens).toBeLessThan(10);
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate more tokens for longer text', () => {
      const short = 'hello';
      const long = 'hello world this is a much longer piece of text that should have more tokens';
      expect(estimateTokens(long)).toBeGreaterThan(estimateTokens(short));
    });

    it('should account for code and special characters', () => {
      const code = 'function test() { return "hello"; }';
      const tokens = estimateTokens(code);
      expect(tokens).toBeGreaterThan(5);
    });

    it('should handle Swedish characters', () => {
      const swedish = 'Hej på dig! Hur mår du? Åäö';
      const tokens = estimateTokens(swedish);
      expect(tokens).toBeGreaterThan(5);
    });
  });

  describe('strategyFor', () => {
    it('should return fast strategy for fast mode', () => {
      const strategy = strategyFor('fast');
      expect(strategy.allowTools).toBe(false);
      expect(strategy.topK).toBe(2);
      expect(strategy.deadlineMs).toBe(7000);
    });

    it('should return auto strategy for auto mode', () => {
      const strategy = strategyFor('auto');
      expect(strategy.allowTools).toBe(true);
      expect(strategy.topK).toBe(3);
      expect(strategy.deadlineMs).toBe(18000);
    });

    it('should return extended strategy for extended mode', () => {
      const strategy = strategyFor('extended');
      expect(strategy.allowTools).toBe(true);
      expect(strategy.topK).toBe(8);
      expect(strategy.deadlineMs).toBe(25000);
    });

    it('should default to auto for unknown mode', () => {
      const strategy = strategyFor('unknown' as any);
      expect(strategy.allowTools).toBe(true);
    });
  });

  describe('needsTools', () => {
    it('should detect part numbers', () => {
      expect(needsTools('Vad är artikelnummer 8624567?')).toBe(true);
      expect(needsTools('Check part 12345-678')).toBe(true);
    });

    it('should detect time-sensitive queries', () => {
      expect(needsTools('vad händer idag?')).toBe(true);
      expect(needsTools('current weather')).toBe(true);
      expect(needsTools('senaste nytt')).toBe(true);
    });

    it('should detect company/organization queries', () => {
      expect(needsTools('Vad är Lex Automotive?')).toBe(true);
      expect(needsTools('Tell me about Volvo')).toBe(true);
    });

    it('should detect explicit search requests', () => {
      expect(needsTools('sök efter Volvo 2025')).toBe(true);
      expect(needsTools('search for latest models')).toBe(true);
    });

    it('should return false for simple queries', () => {
      expect(needsTools('Hej, hur mår du?')).toBe(false);
      expect(needsTools('Vad heter du?')).toBe(false);
      expect(needsTools('hello')).toBe(false);
    });
  });

  describe('trimHistory', () => {
    it('should trim history when token limit exceeded', () => {
      const systemMessages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
      ];
      const history = Array(20).fill({ role: 'user' as const, content: 'Test message' });

      const result = trimHistory(systemMessages, history, {
        maxTokens: 100,
        reserveForResponse: 50,
        reserveForTools: 20,
      });

      expect(result.history.length).toBeLessThan(history.length);
      expect(result.system).toEqual(systemMessages);
    });

    it('should preserve system messages', () => {
      const systemMessages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
      ];
      const history = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      const result = trimHistory(systemMessages, history, {
        maxTokens: 50,
        reserveForResponse: 10,
        reserveForTools: 5,
      });

      expect(result.system).toEqual(systemMessages);
    });

    it('should handle empty history', () => {
      const result = trimHistory([], [], {
        maxTokens: 100,
        reserveForResponse: 50,
        reserveForTools: 20,
      });

      expect(result.history).toEqual([]);
      expect(result.system).toEqual([]);
    });
  });
});
