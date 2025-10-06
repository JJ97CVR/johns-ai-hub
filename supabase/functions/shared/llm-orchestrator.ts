// LLM Orchestration - Agentic tool-calling loop with multi-provider support
// Handles the core AI interaction logic with tools and deadline management

import type { Message as LLMMessage, Citation } from './llm-router.ts';
import { LLMRouter, type LLMRequest } from './llm-router.ts';
import { tools, executeTool, type ToolExecutionContext } from './tools.ts';
import { withDeadline, type ChatMode } from './mode-strategy.ts';
import { logQueryAnalytics } from './analytics.ts';
import { traceExecution } from './observability.ts';

export interface OrchestratorConfig {
  model: string;
  mode: ChatMode;
  maxIterations: number;
  maxTokens: number;
  temperature: number;
  deadlineMs: number;
  shouldUseTools: boolean;
}

export interface OrchestratorContext extends ToolExecutionContext {
  messages: LLMMessage[];
  config: OrchestratorConfig;
  requestId: string;
}

export interface OrchestratorResult {
  assistantContent: string;
  toolsUsed: string[];
  citations: Citation[];
  progressEvents: string[];
  timings: {
    llm: number;
    tools: number;
  };
  tokensIn: number;
  tokensOut: number;
}

/**
 * Extract token usage from multi-provider responses
 */
function extractTokenUsage(fullResponse: any): { tokensIn: number; tokensOut: number } {
  // OpenAI format
  if (fullResponse.usage?.prompt_tokens !== undefined) {
    return {
      tokensIn: fullResponse.usage.prompt_tokens || 0,
      tokensOut: fullResponse.usage.completion_tokens || 0,
    };
  }
  
  // Anthropic format
  if (fullResponse.usage?.input_tokens !== undefined) {
    return {
      tokensIn: fullResponse.usage.input_tokens || 0,
      tokensOut: fullResponse.usage.output_tokens || 0,
    };
  }
  
  // Google/Gemini format
  if (fullResponse.usageMetadata?.promptTokenCount !== undefined) {
    return {
      tokensIn: fullResponse.usageMetadata.promptTokenCount || 0,
      tokensOut: fullResponse.usageMetadata.candidatesTokenCount || 0,
    };
  }
  
  // Fallback if no usage data available
  return { tokensIn: 0, tokensOut: 0 };
}

/**
 * Parse multi-provider LLM responses (OpenAI, Claude, Gemini)
 */
function parseToolResponse(fullResponse: any, requestId: string): {
  responseMessage: any;
  toolCalls: any[];
} {
  let responseMessage: any;
  let toolCalls: any[] = [];

  // CASE 1: OpenAI format (choices array)
  if (fullResponse.choices && fullResponse.choices[0]) {
    responseMessage = fullResponse.choices[0].message;
    toolCalls = responseMessage.tool_calls || [];
    console.log(`[${requestId}] ✅ Detected OpenAI format`);
  }
  // CASE 2: Claude format (content array with tool_use blocks)
  else if (Array.isArray(fullResponse.content)) {
    responseMessage = { role: 'assistant', content: null, tool_calls: [] };
    
    for (const block of fullResponse.content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
      } else if (block.type === 'text') {
        responseMessage.content = block.text;
      }
    }
    responseMessage.tool_calls = toolCalls;
    console.log(`[${requestId}] ✅ Detected Claude format`);
  }
  // CASE 3: Gemini format (functionCall object)
  else if (fullResponse.functionCall) {
    toolCalls = [{
      id: crypto.randomUUID(),
      type: 'function',
      function: {
        name: fullResponse.functionCall.name,
        arguments: JSON.stringify(fullResponse.functionCall.args)
      }
    }];
    responseMessage = { role: 'assistant', content: fullResponse.content || null, tool_calls: toolCalls };
    console.log(`[${requestId}] ✅ Detected Gemini format`);
  }
  else {
    console.error(`[${requestId}] ❌ Unknown response format`, fullResponse);
    throw new Error('Unknown LLM response format');
  }

  return { responseMessage, toolCalls };
}

/**
 * Save checkpoint during agentic loop (Sprint 4, Enhanced Sprint 6)
 */
async function saveCheckpoint(
  supabase: any,
  requestId: string,
  conversationId: string,
  userId: string,
  iteration: number,
  state: any,
  partialContent: string,
  toolsUsed: string[]
): Promise<void> {
  try {
    // Upsert to update existing checkpoint or create new
    await supabase.from('loop_checkpoints').upsert({
      request_id: requestId,
      conversation_id: conversationId,
      user_id: userId,
      iteration,
      state,
      partial_content: partialContent,
      tools_used: toolsUsed,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour expiry
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'request_id',
      ignoreDuplicates: false
    });
  } catch (error) {
    console.error('[Checkpoint] Failed to save:', error);
  }
}

/**
 * Restore checkpoint if request timed out (Sprint 4, Enhanced Sprint 6)
 */
async function restoreCheckpoint(
  supabase: any,
  requestId: string
): Promise<{ iteration: number; partialContent: string; toolsUsed: string[] } | null> {
  try {
    const { data, error } = await supabase
      .from('loop_checkpoints')
      .select('*')
      .eq('request_id', requestId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      iteration: data.iteration,
      partialContent: data.partial_content || '',
      toolsUsed: data.tools_used || []
    };
  } catch {
    return null;
  }
}

/**
 * Cleanup old checkpoints (Sprint 6)
 * Should be called periodically or at the end of successful requests
 */
async function cleanupOldCheckpoints(
  supabase: any,
  conversationId?: string
): Promise<void> {
  try {
    // Delete checkpoints older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from('loop_checkpoints')
      .delete()
      .lt('created_at', cutoff);
    
    // If conversationId provided, only cleanup for this conversation
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    await query;
  } catch (error) {
    console.error('[Checkpoint] Failed to cleanup old checkpoints:', error);
  }
}

/**
 * Execute the agentic loop with tool calling
 * Enhanced with LangSmith tracing for observability
 */
export async function executeAgenticLoop(
  context: OrchestratorContext
): Promise<OrchestratorResult> {
  const { messages, config, requestId, supabaseClient, conversationId, userId } = context;
  const { model, maxIterations, maxTokens, temperature, deadlineMs, shouldUseTools } = config;
  
  // Wrap entire orchestration in LangSmith trace
  const { result } = await traceExecution(
    {
      name: 'lex-agentic-loop',
      runType: 'chain',
      inputs: {
        model,
        maxIterations,
        shouldUseTools,
        messageCount: messages.length,
      },
      tags: ['orchestrator', 'agentic-loop', model],
      metadata: {
        requestId,
        conversationId,
        userId,
        mode: config.mode,
      },
    },
    async () => {
      let assistantContent = '';
      const toolsUsed: string[] = [];
      const citations: Citation[] = [];
      const progressEvents: string[] = [];
      const timings = { llm: 0, tools: 0 };
      let totalTokensIn = 0;
      let totalTokensOut = 0;
      
      let iterations = 0;
      const llmRouter = new LLMRouter();
      
      // Sprint 4: Check for existing checkpoint
      const checkpoint = await restoreCheckpoint(supabaseClient, requestId);
      if (checkpoint) {
        iterations = checkpoint.iteration;
        assistantContent = checkpoint.partialContent;
        toolsUsed.push(...checkpoint.toolsUsed);
        progressEvents.push(`✅ Restored from checkpoint at iteration ${iterations}`);
        console.log(`[${requestId}] ♻️ Restored checkpoint: iteration=${iterations}, tools=${checkpoint.toolsUsed.length}`);
      }
      
      console.log(`[${requestId}] 🔄 Starting agentic loop: maxIterations=${maxIterations}, shouldUseTools=${shouldUseTools}`);
  
  try {
    await withDeadline(
      (async () => {
        while (iterations < maxIterations) {
          iterations++;
          
          try {
            const llmStart = Date.now();
            const llmResponse = await llmRouter.chat({
              model,
              messages,
              tools: shouldUseTools ? tools : undefined,
              stream: false,
              max_tokens: maxTokens,
              temperature,
            });
      
            const fullResponse = llmResponse.json;
            timings.llm += Date.now() - llmStart;
            
            if (!fullResponse) {
              console.error(`[${requestId}] Invalid LLM response: null or undefined`);
              break;
            }

            // Extract token usage from this LLM call
            const { tokensIn, tokensOut } = extractTokenUsage(fullResponse);
            totalTokensIn += tokensIn;
            totalTokensOut += tokensOut;
            
            console.log(`[${requestId}][Iteration ${iterations}] Tokens: in=${tokensIn}, out=${tokensOut} (total: ${totalTokensIn}/${totalTokensOut})`);

            // Parse multi-provider response
            const { responseMessage, toolCalls } = parseToolResponse(fullResponse, requestId);
            
            // Check if AI wants to use tools
            if (toolCalls.length > 0) {
              messages.push(responseMessage);
        
              // Execute each tool
              for (const toolCall of responseMessage.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);
                
                console.log(`[${requestId}][Iteration ${iterations}] 🔧 Tool call: ${toolName}`, toolArgs);
                toolsUsed.push(toolName);
                
                let toolResult: any;
                const toolStart = Date.now();
                try {
                  const executionResult = await executeTool(toolName, toolArgs, context);
                  
                  toolResult = executionResult.result;
                  
                  // Merge citations and progress events
                  if (executionResult.citations) {
                    citations.push(...executionResult.citations);
                  }
                  if (executionResult.progressEvents) {
                    progressEvents.push(...executionResult.progressEvents);
                  }
                  
                  // Special handling for create_artifact
                  if (toolName === 'create_artifact' && toolResult.includes('Download URL:')) {
                    const filename = toolArgs.filename;
                    const urlMatch = toolResult.match(/Download URL: (.+)/);
                    if (urlMatch) {
                      assistantContent += `\n\n📄 **Fil skapad:** [${filename}](${urlMatch[1]})\n`;
                    }
                  }
                  
                  // Log analytics for tool usage
                  await logQueryAnalytics(
                    { supabaseClient, conversationId, userId },
                    {
                      query: toolArgs.query || toolArgs.url || `${toolName} execution`,
                      queryType: toolName.replace('_', ' '),
                      processingTimeMs: Date.now() - toolStart,
                      cacheHit: false,
                      model: 'tool',
                      provider: 'tool',
                      toolsCalled: [toolName],
                    }
                  );
                
                } catch (toolError) {
                  console.error(`[${requestId}] ❌ Tool ${toolName} failed:`, toolError);
                  toolResult = `Tool ${toolName} encountered an error: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`;
                }
                
                const toolDuration = Date.now() - toolStart;
                timings.tools += toolDuration;
                console.log(`[${requestId}][Iteration ${iterations}] ✅ Tool completed: ${toolName} (${toolDuration}ms)`);
                
                // Add tool result to conversation
                messages.push({
                  role: 'tool' as any,
                  tool_call_id: toolCall.id,
                  content: toolResult,
                } as any);
              }
              
              // Continue loop to let AI process tool results
              continue;
            }
            
            // No tool calls - AI is done
            assistantContent = responseMessage.content || '';
            break;
          } catch (error) {
            console.error(`[${requestId}][Iteration ${iterations}] LLM error:`, error);
            throw error;
          }
        }
      })(),
      deadlineMs,
      `Request exceeded ${deadlineMs}ms deadline`
    );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'AI service unavailable';
        console.error(`[${requestId}] Orchestration error:`, errorMsg);
        
        // Sprint 4: Save checkpoint on timeout
        if (errorMsg.includes('deadline') || errorMsg.includes('timeout')) {
          console.log(`[${requestId}] 💾 Saving checkpoint due to timeout`);
          await saveCheckpoint(
            supabaseClient,
            requestId,
            conversationId || '',
            userId || '',
            iterations,
            { messages, model, maxIterations },
            assistantContent,
            toolsUsed
          );
          progressEvents.push('⏱️ Request timed out - checkpoint saved');
        }
        
        throw error;
      }
      
      // Cleanup old checkpoints on successful completion
      if (assistantContent && conversationId) {
        await cleanupOldCheckpoints(supabaseClient, conversationId);
      }
      
      return {
        assistantContent,
        toolsUsed,
        citations,
        progressEvents,
        timings,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
      };
    }
  );
  
  return result;
}
