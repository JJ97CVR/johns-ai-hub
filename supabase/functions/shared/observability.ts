/**
 * Observability Module
 * Sprint 1: Combines structured logging, LangSmith tracing, and cost tracking
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger, type StructuredLogger } from './structured-logger.ts';
import { 
  getLangSmithConfig, 
  createTrace, 
  endTrace, 
  type TraceContext 
} from './langsmith-config.ts';
import { trackCost } from './cost-tracker.ts';

/**
 * Enhanced observability context for requests
 */
export interface ObservabilityContext {
  requestId: string;
  conversationId?: string;
  userId?: string;
  model?: string;
  mode?: string;
}

/**
 * Create an observability-aware logger
 */
export function createObservableLogger(
  functionName: string,
  context: ObservabilityContext,
  supabase?: SupabaseClient
): StructuredLogger {
  const logger = createLogger(functionName, supabase);
  
  // Create a child logger with the context
  return logger.child({
    conversationId: context.conversationId,
    userId: context.userId,
    metadata: {
      requestId: context.requestId,
      model: context.model,
      mode: context.mode,
    },
  });
}

/**
 * Trace a function execution with LangSmith
 */
export async function traceExecution<T>(
  options: {
    name: string;
    runType: 'chain' | 'llm' | 'tool' | 'retriever';
    inputs: Record<string, unknown>;
    tags?: string[];
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<T>
): Promise<{ result: T; runId: string | null }> {
  const config = getLangSmithConfig();
  
  if (!config.enabled) {
    const result = await fn();
    return { result, runId: null };
  }
  
  const runId = crypto.randomUUID();
  const context: TraceContext = {
    runId,
    runName: options.name,
    runType: options.runType,
    inputs: options.inputs,
    metadata: options.metadata,
    tags: options.tags,
  };
  
  await createTrace(context, config);
  
  try {
    const result = await fn();
    await endTrace(runId, { result }, undefined, config);
    return { result, runId };
  } catch (error) {
    await endTrace(runId, {}, error as Error, config);
    throw error;
  }
}

/**
 * Complete observability wrapper for LLM calls
 */
export async function observeLLMCall(
  options: {
    supabase: SupabaseClient;
    logger: StructuredLogger;
    context: ObservabilityContext;
    tokensIn: number;
    tokensOut: number;
    processingTimeMs: number;
    toolsCalled?: string[];
  }
): Promise<void> {
  const { supabase, logger, context, tokensIn, tokensOut, processingTimeMs, toolsCalled } = options;
  
  // Log to structured logger
  await logger.info('LLM call completed', {
    metadata: {
      tokensIn,
      tokensOut,
      processingTimeMs,
      toolsCalled: toolsCalled || [],
      model: context.model,
    },
  });
  
  // Track cost if we have the necessary context
  if (context.conversationId && context.userId && context.model) {
    await trackCost(supabase, {
      conversationId: context.conversationId,
      userId: context.userId,
      model: context.model,
      tokensIn,
      tokensOut,
      processingTimeMs,
      toolsCalled,
    });
  }
}
