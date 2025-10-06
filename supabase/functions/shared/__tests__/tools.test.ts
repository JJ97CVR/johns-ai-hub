import { describe, it, expect, vi } from 'vitest';
import { tools, executeTool } from '../tools.ts';

describe('tools', () => {
  describe('tool definitions', () => {
    it('should have web_search tool', () => {
      const webSearch = tools.find(t => t.function.name === 'web_search');
      expect(webSearch).toBeDefined();
      expect(webSearch?.function.parameters.required).toContain('query');
    });

    it('should have knowledge_base_search tool', () => {
      const kbSearch = tools.find(t => t.function.name === 'knowledge_base_search');
      expect(kbSearch).toBeDefined();
      expect(kbSearch?.function.parameters.required).toContain('query');
    });

    it('should have fetch_url tool', () => {
      const fetchUrl = tools.find(t => t.function.name === 'fetch_url');
      expect(fetchUrl).toBeDefined();
      expect(fetchUrl?.function.parameters.required).toContain('url');
    });

    it('should have create_artifact tool', () => {
      const createArtifact = tools.find(t => t.function.name === 'create_artifact');
      expect(createArtifact).toBeDefined();
      expect(createArtifact?.function.parameters.required).toContain('filename');
      expect(createArtifact?.function.parameters.required).toContain('content');
    });
  });

  describe('executeTool', () => {
    const mockContext = {
      supabaseClient: {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
            getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.com/file.txt' } })),
          })),
        },
      },
      conversationId: 'test-conv',
      userId: 'test-user',
      requestId: 'test-req',
      mode: 'auto' as const,
      partNo: null,
      extractedEntities: {},
      startTime: Date.now(),
    };

    it('should execute create_artifact tool', async () => {
      const result = await executeTool(
        'create_artifact',
        {
          filename: 'test.txt',
          content: 'Hello World',
          language: 'text',
        },
        mockContext
      );

      expect(result.result).toContain('File created successfully');
      expect(result.result).toContain('test.txt');
    });

    it('should return error for unknown tool', async () => {
      const result = await executeTool(
        'unknown_tool',
        {},
        mockContext
      );

      expect(result.result).toContain('Unknown tool');
    });

    it('should return progress events for web_search', async () => {
      // Mock web search to avoid actual API calls
      vi.mock('../web-search.ts', () => ({
        searchWeb: vi.fn(() => Promise.resolve({
          results: [
            { title: 'Test', url: 'https://test.com', description: 'Test result' }
          ]
        })),
      }));

      const result = await executeTool(
        'web_search',
        { query: 'test query' },
        mockContext
      );

      expect(result.progressEvents).toBeDefined();
      expect(result.progressEvents?.length).toBeGreaterThan(0);
    });
  });
});
