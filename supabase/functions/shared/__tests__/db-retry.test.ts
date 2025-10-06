import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, withRetryQuery } from '../db-retry.ts';

describe('db-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      const mockFn = vi.fn(async () => ({ data: 'success', error: null }));
      
      const result = await withRetry(mockFn);
      
      expect(result.data).toBe('success');
      expect(result.error).toBeNull();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw { code: 'PGRST301', message: 'connection timeout' };
        }
        return { data: 'success', error: null };
      });

      const result = await withRetry(mockFn, { maxRetries: 3, baseDelay: 10 });
      
      expect(result.data).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-transient errors', async () => {
      const mockFn = vi.fn(async () => {
        throw { code: '23505', message: 'duplicate key' };
      });

      await expect(withRetry(mockFn)).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should give up after max retries', async () => {
      const mockFn = vi.fn(async () => {
        throw { code: 'PGRST301', message: 'timeout' };
      });

      await expect(withRetry(mockFn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          throw { message: 'connection timeout' };
        }
        return { data: 'success', error: null };
      });

      const result = await withRetry(mockFn, { maxRetries: 3, baseDelay: 10 });
      
      expect(result.data).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle deadlock errors', async () => {
      let attempts = 0;
      const mockFn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          throw { code: '40P01', message: 'deadlock detected' };
        }
        return { data: 'success', error: null };
      });

      const result = await withRetry(mockFn, { maxRetries: 3, baseDelay: 10 });
      
      expect(result.data).toBe('success');
    });
  });

  describe('withRetryQuery', () => {
    it('should execute query successfully', async () => {
      const mockQueryFn = vi.fn(async () => ({ data: { id: '1' }, error: null }));

      const result = await withRetryQuery(mockQueryFn);
      
      expect(result.data).toEqual({ id: '1' });
      expect(result.error).toBeNull();
    });

    it('should retry query on transient failure', async () => {
      let attempts = 0;
      const mockQueryFn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          return { data: null, error: { code: 'PGRST301', message: 'timeout' } };
        }
        return { data: { id: '1' }, error: null };
      });

      const result = await withRetryQuery(mockQueryFn, { maxRetries: 3, baseDelay: 10 });
      
      expect(result.data).toEqual({ id: '1' });
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });
  });
});
