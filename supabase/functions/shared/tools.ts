// Tool System - Definitions and execution for AI agent tools
// Handles web search, knowledge base, URL fetching, and artifact creation

import { searchWeb, fetchWebPage } from './web-search.ts';
import { retrieveRelevantKnowledge } from './knowledge-retrieval.ts';
import { enrichQueryWithEntities } from './memory.ts';
import { hashQuery } from './learning.ts';
import { logInfo, logError } from './logger-utils.ts';
import type { ChatMode } from './mode-strategy.ts';
import type { Citation } from './llm-router.ts';

// Tool definitions for AI agent
export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: `Search the web for current information. Use when:
- User asks about something you don't know (companies, products, people, current events)
- Information might have changed since training (prices, specifications, news)
- User explicitly requests a search
- Asking about specific organizations like "Lex Automotive", "Volvo 2025", etc.
Examples: "What is Lex Automotive?", "Latest Volvo models", "Current oil prices"`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (keep it concise and specific)',
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'knowledge_base_search',
      description: `Search internal knowledge base for organization-specific information. Use when:
- User asks about internal processes, files, or data
- Question relates to previous conversations
- Looking for cached answers or organizational facts
Examples: "Where is the Volvo database?", "How do I translate parts?", "What's our workflow?"`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for internal knowledge',
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'fetch_url',
      description: 'Fetch content from a specific URL to read details. Use after web_search to get full content from a promising result.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch (must be a valid http/https URL)',
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_artifact',
      description: `Create a downloadable file artifact (code, markdown, HTML, etc.) for the user. Use when:
- User asks to create a file, document, or code snippet they can download
- Generating code examples, templates, or documentation
- Creating data files (CSV, JSON, XML)
Examples: "Create a Python script for...", "Generate an HTML template", "Make a CSV file with..."`,
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'File name with appropriate extension (e.g., "example.py", "data.json")',
          },
          content: {
            type: 'string',
            description: 'Complete file content',
          },
          language: {
            type: 'string',
            description: 'Programming language or file type for syntax highlighting',
          }
        },
        required: ['filename', 'content']
      }
    }
  }
];

export interface ToolExecutionContext {
  supabaseClient: any;
  conversationId: string;
  userId: string;
  requestId: string;
  mode: ChatMode;
  partNo: string | null;
  extractedEntities: Record<string, any>;
  startTime: number;
}

export interface ToolExecutionResult {
  result: string;
  citations?: Citation[];
  progressEvents?: string[];
}

/**
 * Execute a tool by name with given arguments
 */
export async function executeTool(
  toolName: string,
  toolArgs: any,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { supabaseClient, conversationId, userId, requestId, mode, partNo, extractedEntities, startTime } = context;
  const citations: Citation[] = [];
  const progressEvents: string[] = [];
  
  let toolResult: string;
  
  // WEB SEARCH
  if (toolName === 'web_search') {
    progressEvents.push(`Söker på webben: "${toolArgs.query.slice(0, 50)}..."`);
    const searchResults = await searchWeb(toolArgs.query);
    toolResult = searchResults 
      ? JSON.stringify(searchResults, null, 2)
      : 'No results found';
    
    // Extract citations from search results
    if (searchResults && searchResults.results) {
      progressEvents.push(`Hittade ${searchResults.results.length} webbresultat`);
      for (const result of searchResults.results.slice(0, 3)) {
        citations.push({
          title: result.title,
          url: result.url,
          excerpt: result.description,
        });
      }
    }
  }
  
  // KNOWLEDGE BASE SEARCH
  else if (toolName === 'knowledge_base_search') {
    progressEvents.push('Söker i kunskapsbasen...');
    // FIX P1: Enrich knowledge base search with entities
    const enrichedKBQuery = enrichQueryWithEntities(toolArgs.query, extractedEntities);
    const knowledge = await retrieveRelevantKnowledge(enrichedKBQuery, { mode, partNo });
    
    // Build context string
    let context = 'Internal Knowledge:\n\n';
    
    const totalHits = (knowledge.knowledge?.length || 0) + (knowledge.patterns?.length || 0) + (knowledge.orgFacts?.length || 0);
    progressEvents.push(`Hittade ${totalHits} relevanta källor i KB`);
    
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
    
    toolResult = context || 'No internal knowledge found';
  }
  
  // FETCH URL
  else if (toolName === 'fetch_url') {
    progressEvents.push(`Hämtar innehåll från: ${toolArgs.url}`);
    const pageContent = await fetchWebPage(toolArgs.url);
    toolResult = pageContent || 'Failed to fetch page content';
    
    // Add citation
    if (pageContent) {
      progressEvents.push(`Läste ${pageContent.length} tecken från sidan`);
      citations.push({
        url: toolArgs.url,
        excerpt: pageContent.slice(0, 200) + '...',
      });
    }
  }
  
  // CREATE ARTIFACT
  else if (toolName === 'create_artifact') {
    const { filename, content, language } = toolArgs;
    
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
      toolResult = `Failed to create artifact: ${uploadError.message}`;
    } else {
      // Get public URL
      const { data: urlData } = supabaseClient.storage
        .from('chat-files')
        .getPublicUrl(filePath);
      
      toolResult = `File created successfully: ${filename}\nDownload URL: ${urlData.publicUrl}`;
      logInfo('tools', `Artifact created: ${filename}`, { requestId, filename });
    }
  }
  
  // UNKNOWN TOOL
  else {
    toolResult = `Unknown tool: ${toolName}`;
  }
  
  return {
    result: toolResult,
    citations: citations.length > 0 ? citations : undefined,
    progressEvents: progressEvents.length > 0 ? progressEvents : undefined,
  };
}
