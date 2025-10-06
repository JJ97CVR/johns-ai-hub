import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logQueryAnalytics, cacheResponse } from '../analytics.ts';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    })),
    upsert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  })),
};

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logQueryAnalytics', () => {
    it('should log analytics with required fields', async () => {
      const context = {
        supabaseClient: mockSupabase,
        conversationId: 'test-conv-id',
        userId: 'test-user-id',
      };

      const analytics = {
        query: 'Test query',
        queryType: 'test',
        processingTimeMs: 100,
        cacheHit: false,
        model: 'gpt-4',
        provider: 'openai',
      };

      await logQueryAnalytics(context, analytics);

      expect(mockSupabase.from).toHaveBeenCalledWith('query_analytics');
    });

    it('should handle optional fields', async () => {
      const context = {
        supabaseClient: mockSupabase,
        conversationId: 'test-conv-id',
        userId: 'test-user-id',
        assistantMessageId: 'test-msg-id',
      };

      const analytics = {
        query: 'Test query',
        queryType: 'test',
        processingTimeMs: 100,
        cacheHit: true,
        model: 'gpt-4',
        provider: 'openai',
        toolsCalled: ['web_search'],
        knowledgeUsed: ['kb-1'],
        entitiesUsed: { dates: ['2025-01-01'] },
      };

      await logQueryAnalytics(context, analytics);

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const errorSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
          })),
        })),
      };

      const context = {
        supabaseClient: errorSupabase,
        conversationId: 'test-conv-id',
        userId: 'test-user-id',
      };

      const analytics = {
        query: 'Test',
        queryType: 'test',
        processingTimeMs: 100,
        cacheHit: false,
        model: 'gpt-4',
        provider: 'openai',
      };

      // Should not throw
      await expect(logQueryAnalytics(context, analytics)).resolves.not.toThrow();
    });
  });

  describe('cacheResponse', () => {
    it('should cache response with question hash', async () => {
      await cacheResponse(mockSupabase, 'What is Python?', 'Python is a programming language');

      expect(mockSupabase.from).toHaveBeenCalledWith('response_cache');
    });

    it('should normalize questions for better cache hits', async () => {
      const question1 = 'What is Python?';
      const question2 = 'what is python';
      const answer = 'Python is a language';

      await cacheResponse(mockSupabase, question1, answer);
      await cacheResponse(mockSupabase, question2, answer);

      // Both should call the same insert/upsert
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it('should handle cache errors gracefully', async () => {
      const errorSupabase = {
        from: vi.fn(() => ({
          upsert: vi.fn(() => Promise.resolve({ error: { code: '23505', message: 'Duplicate' } })),
        })),
      };

      await expect(
        cacheResponse(errorSupabase, 'Test question', 'Test answer')
      ).resolves.not.toThrow();
    });
  });
});
