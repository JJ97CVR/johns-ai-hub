/**
 * LangSmith Configuration
 * Sprint 1: Observability
 * 
 * Provides LangSmith integration for tracing and monitoring LLM calls
 */

export interface LangSmithConfig {
  apiKey: string;
  projectName: string;
  endpoint: string;
  enabled: boolean;
}

/**
 * Get LangSmith configuration from environment
 */
export function getLangSmithConfig(): LangSmithConfig {
  const apiKey = Deno.env.get('LANGSMITH_API_KEY') || '';
  const projectName = Deno.env.get('LANGSMITH_PROJECT') || 'lex-assistant';
  const endpoint = Deno.env.get('LANGSMITH_ENDPOINT') || 'https://api.smith.langchain.com';
  
  return {
    apiKey,
    projectName,
    endpoint,
    enabled: apiKey.length > 0,
  };
}

/**
 * LangSmith trace context
 */
export interface TraceContext {
  runId: string;
  runName: string;
  runType: 'chain' | 'llm' | 'tool' | 'retriever';
  inputs: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Create a new trace for LangSmith
 */
export async function createTrace(
  context: TraceContext,
  config: LangSmithConfig
): Promise<string | null> {
  if (!config.enabled) {
    return null;
  }

  try {
    const response = await fetch(`${config.endpoint}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        id: context.runId,
        name: context.runName,
        run_type: context.runType,
        inputs: context.inputs,
        start_time: new Date().toISOString(),
        extra: {
          metadata: context.metadata || {},
          tags: context.tags || [],
        },
        project_name: config.projectName,
      }),
    });

    if (!response.ok) {
      console.error('Failed to create LangSmith trace:', await response.text());
      return null;
    }

    return context.runId;
  } catch (error) {
    console.error('Error creating LangSmith trace:', error);
    return null;
  }
}

/**
 * Update a trace with outputs and end time
 */
export async function endTrace(
  runId: string,
  outputs: Record<string, unknown>,
  error?: Error,
  config?: LangSmithConfig
): Promise<void> {
  const configToUse = config || getLangSmithConfig();
  
  if (!configToUse.enabled || !runId) {
    return;
  }

  try {
    await fetch(`${configToUse.endpoint}/runs/${runId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': configToUse.apiKey,
      },
      body: JSON.stringify({
        outputs,
        end_time: new Date().toISOString(),
        error: error ? {
          message: error.message,
          stack: error.stack,
        } : undefined,
      }),
    });
  } catch (err) {
    console.error('Error ending LangSmith trace:', err);
  }
}

/**
 * Wrapper for tracing async functions
 */
export function traceable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    name: string;
    runType: 'chain' | 'llm' | 'tool' | 'retriever';
    tags?: string[];
    metadata?: Record<string, unknown>;
  }
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const config = getLangSmithConfig();
    
    if (!config.enabled) {
      // If LangSmith is disabled, just run the function
      return fn(...args);
    }

    const runId = crypto.randomUUID();
    const context: TraceContext = {
      runId,
      runName: options.name,
      runType: options.runType,
      inputs: { args },
      metadata: options.metadata,
      tags: options.tags,
    };

    await createTrace(context, config);

    try {
      const result = await fn(...args);
      await endTrace(runId, { result }, undefined, config);
      return result;
    } catch (error) {
      await endTrace(runId, {}, error as Error, config);
      throw error;
    }
  }) as T;
}
