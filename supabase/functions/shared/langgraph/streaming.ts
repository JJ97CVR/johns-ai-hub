/**
 * LEX Graph Streaming - LangGraph
 * Sprint 9: LangGraph Integration
 * 
 * Handles SSE streaming of graph execution events
 */

import type { LEXState } from './state.ts';
import { logInfo, logError } from '../logger-utils.ts';

/**
 * Stream graph execution with SSE
 */
export async function streamGraph(
  graph: any, // CompiledGraph type
  input: Partial<LEXState>,
  config: any
): Promise<ReadableStream> {
  const requestId = config?.configurable?.requestId || 'unknown';
  logInfo('langgraph', 'Starting graph stream', { requestId });
  
  const encoder = new TextEncoder();
  
  return new ReadableStream({
    async start(controller) {
      try {
        // Stream events from graph
        for await (const event of await graph.streamEvents(input, config)) {
          // Filter for relevant events
          
          // Stream LLM tokens
          if (event.event === 'on_chat_model_stream') {
            const chunk = event.data?.chunk;
            if (chunk?.content) {
              const data = `data: ${JSON.stringify({ delta: chunk.content })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          
          // Stream tool start events
          if (event.event === 'on_tool_start') {
            const toolName = event.name;
            const data = `data: ${JSON.stringify({ progress: `Kör verktyg: ${toolName}...` })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          
          // Stream tool end events
          if (event.event === 'on_tool_end') {
            const toolName = event.name;
            const data = `data: ${JSON.stringify({ progress: `✓ ${toolName} klar` })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          
          // Stream progress events from state
          if (event.event === 'on_chain_stream') {
            const progressEvents = event.data?.output?.progressEvents;
            if (progressEvents && progressEvents.length > 0) {
              for (const progressEvent of progressEvents) {
                const data = `data: ${JSON.stringify({ progress: progressEvent })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }
          }
          
          // Stream final result
          if (event.event === 'on_chain_end') {
            const output = event.data.output;
            const lastMessage = output.messages?.[output.messages.length - 1];
            
            const data = `data: ${JSON.stringify({ 
              done: true,
              metadata: {
                messageId: lastMessage?.id,
                toolsUsed: output.toolsUsed || [],
                citations: output.citations || [],
                iterations: output.iterations || 0,
              }
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
            
            logInfo('langgraph', 'Graph stream completed', {
              requestId,
              iterations: output.iterations,
              toolsUsed: output.toolsUsed?.length || 0,
            });
          }
        }
      } catch (error) {
        logError('langgraph', 'Graph stream error', error as Error, { requestId });
        const errorData = `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
      } finally {
        controller.close();
      }
    }
  });
}

/**
 * Non-streaming invoke (for testing)
 */
export async function invokeGraph(
  graph: any,
  input: Partial<LEXState>,
  config: any
): Promise<LEXState> {
  const requestId = config?.configurable?.requestId || 'unknown';
  logInfo('langgraph', 'Invoking graph (non-streaming)', { requestId });
  
  try {
    const result = await graph.invoke(input, config);
    
    logInfo('langgraph', 'Graph invocation completed', {
      requestId,
      iterations: result.iterations,
      toolsUsed: result.toolsUsed?.length || 0,
    });
    
    return result;
  } catch (error) {
    logError('langgraph', 'Graph invocation error', error as Error, { requestId });
    throw error;
  }
}
