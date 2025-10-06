/**
 * LEX Tools - LangChain DynamicStructuredTool Definitions
 * Sprint 9: LangGraph Integration
 * 
 * Defines tools for web search, knowledge base search, and URL fetching
 */

import { DynamicStructuredTool } from 'npm:@langchain/core@^0.2.27/tools';
import { z } from 'npm:zod@^3.23.8';
import { searchWeb, fetchWebPage } from '../web-search.ts';
import { retrieveRelevantKnowledge } from '../knowledge-retrieval.ts';
import { logInfo, logError } from '../logger-utils.ts';

/**
 * Web Search Tool (Brave Search)
 */
export function createWebSearchTool() {
  return new DynamicStructuredTool({
    name: 'web_search',
    description: `Search the web for current information. Use when:
- User asks about something you don't know (companies, products, people, current events)
- Information might have changed since training (prices, specifications, news)
- User explicitly requests a search
- Asking about specific organizations like "Lex Automotive", "Volvo 2025", etc.
Examples: "What is Lex Automotive?", "Latest Volvo models", "Current oil prices"`,
    schema: z.object({
      query: z.string().describe('Search query (keep it concise and specific)'),
    }),
    func: async ({ query }, config) => {
      const requestId = 'unknown'; // RequestId not available in tool config
      logInfo('tools', `Web search: ${query}`, { requestId, tool: 'web_search' });
      
      try {
        const searchResults = await searchWeb(query);
        
        if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
          return 'No results found';
        }
        
        // Format results
        const formatted = searchResults.results.slice(0, 5).map((result: any) => 
          `Title: ${result.title}\nURL: ${result.url}\nSnippet: ${result.description}\n`
        ).join('\n---\n');
        
        return formatted;
      } catch (error) {
        logError('tools', 'Web search error', error as Error, { requestId, query });
        return `Error performing web search: ${(error as Error).message}`;
      }
    },
  });
}

/**
 * Knowledge Base Search Tool (Supabase Vector Store)
 */
export function createKnowledgeSearchTool(supabaseClient: any) {
  return new DynamicStructuredTool({
    name: 'knowledge_base_search',
    description: `Search internal knowledge base for organization-specific information. Use when:
- User asks about internal processes, files, or data
- Question relates to previous conversations
- Looking for cached answers or organizational facts
Examples: "Where is the Volvo database?", "How do I translate parts?", "What's our workflow?"`,
    schema: z.object({
      query: z.string().describe('Search query for internal knowledge'),
      mode: z.enum(['fast', 'auto', 'extended']).default('auto').describe('Search mode'),
    }),
    func: async ({ query, mode }, config) => {
      const requestId = 'unknown'; // RequestId not available in tool config
      logInfo('tools', `KB search: ${query}`, { requestId, tool: 'knowledge_base_search' });
      
      try {
        const knowledge = await retrieveRelevantKnowledge(query, { mode });
        
        // Build context string
        let context = 'Internal Knowledge:\n\n';
        
        const totalHits = (knowledge.knowledge?.length || 0) + 
                         (knowledge.patterns?.length || 0) + 
                         (knowledge.orgFacts?.length || 0);
        
        if (totalHits === 0) {
          return 'No internal knowledge found';
        }
        
        if (knowledge.knowledge?.length > 0) {
          context += 'Knowledge Base:\n';
          knowledge.knowledge.forEach((k: any) => {
            context += `- ${k.title}: ${k.content.slice(0, 300)}...\n`;
          });
        }
        
        if (knowledge.patterns?.length > 0) {
          context += '\nLearned Patterns:\n';
          knowledge.patterns.forEach((p: any) => {
            context += `- ${p.question_pattern}: ${p.answer_template.slice(0, 200)}...\n`;
          });
        }
        
        if (knowledge.orgFacts?.length > 0) {
          context += '\nOrganization Facts:\n';
          knowledge.orgFacts.forEach((f: any) => {
            context += `- ${f.key}: ${f.value}\n`;
          });
        }
        
        return context;
      } catch (error) {
        logError('tools', 'KB search error', error as Error, { requestId, query });
        return `Error searching knowledge base: ${(error as Error).message}`;
      }
    },
  });
}

/**
 * Fetch URL Tool
 */
export function createFetchURLTool() {
  return new DynamicStructuredTool({
    name: 'fetch_url',
    description: 'Fetch content from a specific URL to read details. Use after web_search to get full content from a promising result.',
    schema: z.object({
      url: z.string().url().describe('URL to fetch (must be a valid http/https URL)'),
    }),
    func: async ({ url }, config) => {
      const requestId = 'unknown'; // RequestId not available in tool config
      logInfo('tools', `Fetching URL: ${url}`, { requestId, tool: 'fetch_url' });
      
      try {
        const pageContent = await fetchWebPage(url);
        
        if (!pageContent) {
          return 'Failed to fetch page content';
        }
        
        // Limit to 5000 chars to avoid context overflow
        return pageContent.substring(0, 5000);
      } catch (error) {
        logError('tools', 'Fetch URL error', error as Error, { requestId, url });
        return `Error fetching URL: ${(error as Error).message}`;
      }
    },
  });
}

/**
 * Create Artifact Tool
 */
export function createArtifactTool(supabaseClient: any, userId: string, conversationId: string) {
  return new DynamicStructuredTool({
    name: 'create_artifact',
    description: `Create a downloadable file artifact (code, markdown, HTML, etc.) for the user. Use when:
- User asks to create a file, document, or code snippet they can download
- Generating code examples, templates, or documentation
- Creating data files (CSV, JSON, XML)
Examples: "Create a Python script for...", "Generate an HTML template", "Make a CSV file with..."`,
    schema: z.object({
      filename: z.string().describe('File name with appropriate extension (e.g., "example.py", "data.json")'),
      content: z.string().describe('Complete file content'),
      language: z.string().default('text').describe('Programming language or file type for syntax highlighting'),
    }),
    func: async ({ filename, content, language }, config) => {
      const requestId = 'unknown'; // RequestId not available in tool config
      logInfo('tools', `Creating artifact: ${filename}`, { requestId, tool: 'create_artifact' });
      
      try {
        // Save to Supabase Storage in chat-files bucket
        const filePath = `${userId}/${conversationId}/${filename}`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('chat-files')
          .upload(filePath, new Blob([content], { type: 'text/plain' }), {
            upsert: true,
            contentType: 'text/plain'
          });
        
        if (uploadError) {
          logError('tools', 'Artifact upload error', uploadError, { requestId, filename });
          return `Failed to create artifact: ${uploadError.message}`;
        }
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
          .from('chat-files')
          .getPublicUrl(filePath);
        
        logInfo('tools', `Artifact created successfully: ${filename}`, { requestId, filename });
        return `File created successfully: ${filename}\nDownload URL: ${urlData.publicUrl}`;
      } catch (error) {
        logError('tools', 'Artifact creation error', error as Error, { requestId, filename });
        return `Error creating artifact: ${(error as Error).message}`;
      }
    },
  });
}

/**
 * Get all tools for LEX
 */
export function getLEXTools(supabaseClient: any, userId: string, conversationId: string) {
  return [
    createWebSearchTool(),
    createKnowledgeSearchTool(supabaseClient),
    createFetchURLTool(),
    createArtifactTool(supabaseClient, userId, conversationId),
  ];
}
