import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TIMEOUTS, getModeDeadline } from '../timeouts-config.ts';

describe('timeouts-config', () => {
  const originalEnv = { ...Deno.env.toObject() };

  afterEach(() => {
    // Restore original env
    Object.keys(Deno.env.toObject()).forEach(key => {
      if (!(key in originalEnv)) {
        Deno.env.delete(key);
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      Deno.env.set(key, value);
    });
  });

  describe('TIMEOUTS', () => {
    it('should have default timeout values', () => {
      expect(TIMEOUTS.FRONTEND_TIMEOUT).toBeDefined();
      expect(TIMEOUTS.ACTIVITY_TIMEOUT).toBeDefined();
      expect(TIMEOUTS.API_TIMEOUT).toBeDefined();
      expect(TIMEOUTS.FAST_MODE).toBe(7000);
      expect(TIMEOUTS.AUTO_MODE).toBe(18000);
      expect(TIMEOUTS.EXTENDED_MODE).toBe(25000);
    });

    it('should use default values when no env variables set', () => {
      expect(TIMEOUTS.FRONTEND_TIMEOUT).toBeGreaterThan(0);
      expect(TIMEOUTS.ACTIVITY_TIMEOUT).toBeGreaterThan(0);
      expect(TIMEOUTS.API_TIMEOUT).toBeGreaterThan(0);
    });

    it('should have reasonable timeout values', () => {
      expect(TIMEOUTS.FAST_MODE).toBeLessThan(TIMEOUTS.AUTO_MODE);
      expect(TIMEOUTS.AUTO_MODE).toBeLessThan(TIMEOUTS.EXTENDED_MODE);
      expect(TIMEOUTS.FRONTEND_TIMEOUT).toBeGreaterThan(TIMEOUTS.EXTENDED_MODE);
    });
  });

  describe('getModeDeadline', () => {
    it('should return correct deadline for fast mode', () => {
      expect(getModeDeadline('fast')).toBe(7000);
    });

    it('should return correct deadline for auto mode', () => {
      expect(getModeDeadline('auto')).toBe(18000);
    });

    it('should return correct deadline for extended mode', () => {
      expect(getModeDeadline('extended')).toBe(25000);
    });

    it('should default to auto mode for unknown mode', () => {
      expect(getModeDeadline('unknown' as any)).toBe(18000);
    });
  });
});
