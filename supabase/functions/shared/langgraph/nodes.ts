/**
 * LEX Graph Nodes - LangGraph
 * Sprint 9: LangGraph Integration
 * 
 * Defines the nodes for the agentic loop:
 * - callLLM: Calls the LLM with or without tools
 * - executeTools: Executes tool calls from the LLM
 */

import { ChatOpenAI } from 'npm:@langchain/openai@^0.2.8';
import { ChatAnthropic } from 'npm:@langchain/anthropic@^0.2.13';
import { ChatGoogleGenerativeAI } from 'npm:@langchain/google-genai@^0.0.25';
import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from 'npm:@langchain/core@^0.2.27/messages';
import type { LEXState } from './state.ts';
import { getLEXTools } from './tools.ts';
import { logInfo, logWarn, logError } from '../logger-utils.ts';
import { buildSystemPrompt } from '../prompts/prompt-manager.ts';

/**
 * Node: Call LLM with or without tools
 */
export async function callLLM(state: LEXState): Promise<Partial<LEXState>> {
  const requestId = state.requestId || 'unknown';
  logInfo('langgraph', `Calling LLM (iteration ${state.iterations + 1})`, {
    requestId,
    mode: state.mode,
    model: state.model,
    messageCount: state.messages.length,
  });
  
  try {
    // Select model based on state
    const llm = createLLM(state.model, state.mode);
    
    // Bind tools if mode allows
    const shouldUseTools = state.mode !== 'fast';
    const tools = shouldUseTools 
      ? getLEXTools(state.supabaseClient, state.userId, state.conversationId)
      : [];
    
    const llmWithTools = tools.length > 0 ? llm.bindTools(tools) : llm;
    
    // Build system message if not present
    let messages = [...state.messages];
    if (messages.length === 0 || messages[0].constructor.name !== 'SystemMessage') {
      const systemPrompt = buildSystemPrompt({
        version: 'latest',
        options: {
          mode: state.mode,
        },
      });
      
      messages = [new SystemMessage(systemPrompt), ...messages];
    }
    
    // Invoke LLM
    const response = await llmWithTools.invoke(messages);
    
    const toolCalls = (response as any).tool_calls;
    logInfo('langgraph', 'LLM response received', {
      requestId,
      hasToolCalls: toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0,
      toolCount: toolCalls && Array.isArray(toolCalls) ? toolCalls.length : 0,
    });
    
    // Update state
    return {
      messages: [response],
      iterations: state.iterations + 1,
    };
  } catch (error) {
    logError('langgraph', 'LLM call error', error as Error, { requestId });
    throw error;
  }
}

/**
 * Node: Execute tools
 */
export async function executeTools(state: LEXState): Promise<Partial<LEXState>> {
  const requestId = state.requestId || 'unknown';
  const lastMessage = state.messages[state.messages.length - 1];
  
  const toolCalls = (lastMessage as any).tool_calls;
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    logWarn('langgraph', 'No tool calls found in last message', { requestId });
    return {};
  }
  
  logInfo('langgraph', `Executing ${toolCalls.length} tools`, {
    requestId,
    tools: toolCalls.map((tc: any) => tc.name),
  });
  
  const tools = getLEXTools(state.supabaseClient, state.userId, state.conversationId);
  const toolResults: ToolMessage[] = [];
  const citations: Array<{ title?: string; url: string; excerpt?: string }> = [];
  const toolsUsed: string[] = [];
  const progressEvents: string[] = [];
  
  for (const toolCall of toolCalls) {
    const tool = tools.find(t => t.name === toolCall.name);
    
    if (!tool) {
      logError('langgraph', `Tool not found: ${toolCall.name}`, new Error('Tool not found'), { requestId });
      toolResults.push(
        new ToolMessage({
          tool_call_id: toolCall.id!,
          content: `Error: Tool ${toolCall.name} not found`,
        })
      );
      continue;
    }
    
    try {
      progressEvents.push(`Kör verktyg: ${toolCall.name}...`);
      
      const result = await tool.invoke(toolCall.args!, {
        configurable: { requestId },
      });
      
      toolResults.push(
        new ToolMessage({
          tool_call_id: toolCall.id!,
          content: result,
        })
      );
      
      toolsUsed.push(toolCall.name);
      
      // Extract citations if web_search or fetch_url
      if ((toolCall.name === 'web_search' || toolCall.name === 'fetch_url') && result.includes('URL:')) {
        const urlMatches = result.matchAll(/URL:\s*(https?:\/\/[^\s]+)/g);
        for (const match of urlMatches) {
          citations.push({
            title: toolCall.name === 'web_search' ? 'Web search result' : 'Fetched page',
            url: match[1],
          });
        }
      }
      
      progressEvents.push(`✓ ${toolCall.name} klar`);
    } catch (error) {
      logError('langgraph', `Tool execution error (${toolCall.name})`, error as Error, { requestId });
      toolResults.push(
        new ToolMessage({
          tool_call_id: toolCall.id!,
          content: `Error executing tool: ${(error as Error).message}`,
        })
      );
      progressEvents.push(`✗ ${toolCall.name} misslyckades`);
    }
  }
  
  return {
    messages: toolResults,
    toolsUsed,
    citations,
    progressEvents,
  };
}

/**
 * Helper: Create LLM instance
 */
function createLLM(model: string, mode: 'fast' | 'auto' | 'extended') {
  // Temperature based on mode (only for models that support it)
  const temperature = mode === 'fast' ? 0.1 : mode === 'auto' ? 0.25 : 0.5;
  
  if (model.startsWith('openai/')) {
    const modelName = model.replace('openai/', '');
    
    // GPT-5 models only support default temperature (1.0)
    // Only set temperature for older models
    const isGPT5 = modelName.includes('gpt-5') || modelName.includes('o3') || modelName.includes('o4');
    
    return new ChatOpenAI({
      modelName,
      ...(isGPT5 ? {} : { temperature }), // Don't set temperature for GPT-5+
      streaming: true,
      openAIApiKey: Deno.env.get('OPENAI_API_KEY'),
    });
  } else if (model.startsWith('anthropic/')) {
    const modelName = model.replace('anthropic/', '');
    return new ChatAnthropic({
      modelName,
      temperature,
      streaming: true,
      anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY'),
      // CRITICAL: Don't set top_p for Claude models (they don't support -1)
      topP: undefined,
    });
  } else if (model.startsWith('google/')) {
    const modelName = model.replace('google/', '');
    return new ChatGoogleGenerativeAI({
      modelName,
      temperature,
      streaming: true,
      apiKey: Deno.env.get('GOOGLE_API_KEY'),
    });
  }
  
  throw new Error(`Unknown model: ${model}`);
}
