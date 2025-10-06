/**
 * LangGraph Integration Helper - Bridge to chat/index.ts
 * Sprint 9: LangGraph Integration
 * 
 * Provides a compatible interface to replace executeAgenticLoop
 */

import { HumanMessage, SystemMessage } from 'npm:@langchain/core@^0.2.27/messages';
import { lexGraph } from './graph.ts';
import type { LEXState } from './state.ts';
import { logInfo, logError } from '../logger-utils.ts';
import type { Message as LLMMessage } from '../llm-router.ts';
import type { OrchestratorConfig } from '../llm-orchestrator.ts';

export interface LangGraphContext {
  supabaseClient: any;
  conversationId: string;
  userId: string;
  requestId: string;
  mode: 'fast' | 'auto' | 'extended';
  partNo: string | null;
  extractedEntities: Record<string, any>;
  startTime: number;
  messages: LLMMessage[];
  config: OrchestratorConfig;
  // PHASE 2: Lazy loaders for background data loading
  memoryLoader?: any;
  historyLoader?: any;
  ragLoader?: any;
}

export interface LangGraphResult {
  assistantContent: string;
  toolsUsed: string[];
  citations: Array<{ title?: string; url: string; excerpt?: string }>;
  progressEvents: string[];
  timings: {
    llm: number;
    tools: number;
  };
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * Execute agentic loop using LangGraph
 * Compatible replacement for executeAgenticLoop from llm-orchestrator.ts
 */
export async function executeWithLangGraph(
  context: LangGraphContext,
  assistantMessageId: string
): Promise<LangGraphResult> {
  const { supabaseClient, conversationId, userId, requestId, mode, messages, config } = context;
  
  logInfo('langgraph-integration', 'Starting LangGraph execution', {
    requestId,
    mode,
    model: config.model,
  });
  
  const startTime = Date.now();
  
  try {
    // Convert LLM messages to LangChain format
    const langChainMessages = messages
      .map(msg => {
        if (msg.role === 'system') {
          return new SystemMessage(msg.content as string);
        } else if (msg.role === 'user') {
          return new HumanMessage(msg.content as string);
        }
        // For assistant messages, they'll be reconstructed by the graph
        return null;
      })
      .filter((msg): msg is SystemMessage | HumanMessage => msg !== null);
    
    // Build initial state
    const initialState: Partial<LEXState> = {
      messages: langChainMessages,
      mode,
      model: config.model,
      conversationId,
      userId,
      requestId,
      supabaseClient,
      iterations: 0,
      toolsUsed: [],
      citations: [],
      progressEvents: [],
    };
    
    // Configure graph execution
    const graphConfig = {
      configurable: {
        thread_id: conversationId,
        requestId,
      },
      version: 'v2' as const,
    };
    
    logInfo('langgraph-integration', 'Starting streaming execution', { requestId });
    
    // Streaming setup for progressive database updates
    let assistantContent = '';
    let updateBuffer = '';
    let lastUpdateTime = Date.now();
    const UPDATE_INTERVAL_MS = 500;
    const UPDATE_TOKEN_BATCH = 50;
    
    let toolsUsed: string[] = [];
    let citations: Array<{ title?: string; url: string; excerpt?: string }> = [];
    let progressEvents: string[] = [];
    
    // Metrics for debugging
    let streamEventCount = 0;
    let tokenEventCount = 0;
    let databaseUpdateCount = 0;
    
    // Execute graph with streaming events
    for await (const event of lexGraph.streamEvents(initialState, graphConfig)) {
      streamEventCount++;
      
      // Log ALL event types for debugging
      if (streamEventCount <= 5) { // Log first 5 events to see what we get
        logInfo('langgraph-streaming', `Event type: ${event.event}`, { 
          requestId, 
          eventNumber: streamEventCount,
          eventName: event.name,
        });
      }
      
      // 📝 LLM Token Streaming
      if (event.event === 'on_chat_model_stream') {
        tokenEventCount++;
        const chunk = event.data?.chunk;
        if (chunk?.content) {
          const token = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
          assistantContent += token;
          updateBuffer += token;
          
          const timeSinceUpdate = Date.now() - lastUpdateTime;
          const shouldUpdate = 
            updateBuffer.length >= UPDATE_TOKEN_BATCH || 
            timeSinceUpdate >= UPDATE_INTERVAL_MS;
          
          if (shouldUpdate) {
            databaseUpdateCount++;
            // 🔄 Progressive database update → Realtime → Frontend
            await supabaseClient
              .from('messages')
              .update({ content: assistantContent })
              .eq('id', assistantMessageId);
            
            logInfo('langgraph-streaming', 'Database updated', {
              requestId,
              updateNumber: databaseUpdateCount,
              contentLength: assistantContent.length,
              bufferSize: updateBuffer.length,
            });
            
            updateBuffer = '';
            lastUpdateTime = Date.now();
          }
        }
      }
      
      // 🔧 Tool Progress
      if (event.event === 'on_tool_start') {
        const toolName = event.name || 'unknown_tool';
        logInfo('langgraph', `Tool started: ${toolName}`, { requestId });
        progressEvents.push(`Tool: ${toolName}`);
      }
      
      // ✅ Final Result
      if (event.event === 'on_chain_end') {
        const output = event.data?.output as LEXState | undefined;
        
        if (output) {
          toolsUsed = output.toolsUsed || [];
          citations = output.citations || [];
          progressEvents = output.progressEvents || progressEvents;
        }
        
        // Final database update with complete content
        await supabaseClient
          .from('messages')
          .update({ content: assistantContent })
          .eq('id', assistantMessageId);
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        logInfo('langgraph-integration', 'Graph execution complete', {
          requestId,
          iterations: output?.iterations || 0,
          toolsUsed: toolsUsed.length,
          totalTimeMs: totalTime,
          streamMetrics: {
            totalEvents: streamEventCount,
            tokenEvents: tokenEventCount,
            databaseUpdates: databaseUpdateCount,
            finalContentLength: assistantContent.length,
          },
        });
        
        return {
          assistantContent,
          toolsUsed,
          citations,
          progressEvents,
          timings: {
            llm: totalTime,
            tools: 0,
          },
          tokensIn: 0,
          tokensOut: 0,
        };
      }
    }
    
    // Should never reach here
    throw new Error('Graph streaming ended without final result');
  } catch (error) {
    logError('langgraph-integration', 'Graph execution error', error as Error, { requestId });
    throw error;
  }
}

/**
 * Check if LangGraph should be used based on feature flag
 */
export async function shouldUseLangGraph(supabaseClient: any): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient
      .from('feature_flags')
      .select('enabled')
      .eq('flag_key', 'use_langgraph')
      .single();
    
    if (error || !data) {
      return false; // Default to old implementation if flag doesn't exist
    }
    
    return data.enabled === true;
  } catch (error) {
    logError('langgraph-integration', 'Error checking feature flag', error as Error);
    return false; // Default to old implementation on error
  }
}
