/**
 * Multi-provider LLM Router
 * Supports OpenAI, Anthropic, and Gemini (via Lovable AI Gateway)
 * with streaming, retries, and fallbacks
 */

export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

export type ToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
};

export type LLMRequest = {
  model: string;
  messages: Message[];
  tools?: ToolDef[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
};

import { globalCircuitBreaker } from './circuit-breaker.ts';
import { MODEL_CONFIG, DEFAULT_FALLBACK_MODELS } from './models-config.ts';
import { TIMEOUTS } from './timeouts-config.ts';

export type Citation = {
  title?: string;
  url: string;
  excerpt?: string;
};

export type LLMResponse = {
  stream?: ReadableStream<Uint8Array>;
  json?: any;
  citations: Citation[];
  model: string;
  provider: string;
};

interface LLMProvider {
  chat(req: LLMRequest): Promise<LLMResponse>;
  supportsModel(model: string): boolean;
}

// OpenAI Provider
class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private supportedModels = MODEL_CONFIG.OPENAI;

  supportsModel(model: string): boolean {
    // Check if model is in whitelist or can be prefixed with openai/
    const normalizedModel = model.startsWith('openai/') ? model : `openai/${model}`;
    const supportedList = this.supportedModels as readonly string[];
    return supportedList.includes(model) || supportedList.includes(normalizedModel);
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const modelName = req.model.replace('openai/', '');
    
    // GPT-5 and newer models have different parameters
    const isNewerModel = modelName.startsWith('gpt-5') || 
                         modelName.startsWith('o3') || 
                         modelName.startsWith('o4');
    
    const body: any = {
      model: modelName,
      messages: req.messages,
      stream: req.stream ?? true,
    };

    // Newer models use max_completion_tokens and don't support temperature
    if (isNewerModel) {
      body.max_completion_tokens = req.max_tokens ?? 4096;
    } else {
      body.max_tokens = req.max_tokens ?? 4096;
      if (req.temperature !== undefined) {
        body.temperature = req.temperature;
      }
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools;
      body.tool_choice = 'auto';
      // Prevent mixing text + tool calls in same response when not streaming
      if (!req.stream) {
        body.parallel_tool_calls = false;
      }
    }

    console.log('OpenAI request:', JSON.stringify({ model: body.model, messages: body.messages.length, tools: body.tools?.length }));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUTS.API_TIMEOUT),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI error:', response.status, error);
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    // Handle both streaming and non-streaming responses
    if (req.stream) {
      return {
        stream: response.body!,
        citations: [],
        model: modelName,
        provider: 'openai',
      };
    } else {
      const json = await response.json();
      return {
        json,
        citations: [],
        model: modelName,
        provider: 'openai',
      };
    }
  }
}

// Anthropic Provider
class AnthropicProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  supportsModel(model: string): boolean {
    return model.startsWith('anthropic/') || model.includes('claude');
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const modelName = req.model.replace('anthropic/', '');
    
    // Separate system message from conversation
    const systemMessage = req.messages.find(m => m.role === 'system');
    const conversationMessages = req.messages.filter(m => m.role !== 'system');

    const body: any = {
      model: modelName,
      messages: conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: req.max_tokens ?? 4096,
      stream: req.stream ?? true,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (req.temperature !== undefined) {
      body.temperature = req.temperature;
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
      // Instruct Claude to only return tool_use blocks when using tools
      if (!req.stream && systemMessage) {
        body.system = systemMessage.content + '\n\nWhen using tools, return ONLY tool_use blocks with no explanatory text.';
      }
    }

    console.log('Anthropic request:', JSON.stringify({ model: body.model, messages: body.messages.length, tools: body.tools?.length }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUTS.API_TIMEOUT),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic error:', response.status, error);
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    // Handle both streaming and non-streaming responses
    if (req.stream) {
      return {
        stream: response.body!,
        citations: [],
        model: modelName,
        provider: 'anthropic',
      };
    } else {
      const json = await response.json();
      return {
        json,
        citations: [],
        model: modelName,
        provider: 'anthropic',
      };
    }
  }
}

// Lovable AI Provider (Gemini models)
class LovableAIProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  supportsModel(model: string): boolean {
    return model.startsWith('google/') || model.includes('gemini');
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const body: any = {
      model: req.model,
      messages: req.messages,
      stream: req.stream ?? true,
      max_tokens: req.max_tokens ?? 4096,
    };

    if (req.temperature !== undefined) {
      body.temperature = req.temperature;
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools;
      body.tool_choice = 'auto';
    }

    console.log('Lovable AI request:', JSON.stringify({ model: body.model, messages: body.messages.length, tools: body.tools?.length }));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUTS.API_TIMEOUT),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Lovable AI error:', response.status, error);
      
      // Surface rate limit and payment errors
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable workspace.');
      }
      
      throw new Error(`Lovable AI error (${response.status}): ${error}`);
    }

    // Handle both streaming and non-streaming responses
    if (req.stream) {
      return {
        stream: response.body!,
        citations: [],
        model: req.model,
        provider: 'lovable-ai',
      };
    } else {
      const json = await response.json();
      return {
        json,
        citations: [],
        model: req.model,
        provider: 'lovable-ai',
      };
    }
  }
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on 4xx errors (except 429)
      if (error instanceof Error && error.message.includes('(4')) {
        if (!error.message.includes('429')) {
          throw error;
        }
      }
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * LLM Router with fallback support
 */
export class LLMRouter {
  private providers: LLMProvider[];
  private fallbackModels: string[];

  constructor() {
    this.providers = [];
    this.fallbackModels = [...DEFAULT_FALLBACK_MODELS];

    // Initialize providers based on available API keys
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    if (openaiKey) {
      this.providers.push(new OpenAIProvider(openaiKey));
    }
    if (anthropicKey) {
      this.providers.push(new AnthropicProvider(anthropicKey));
    }
    if (lovableKey) {
      this.providers.push(new LovableAIProvider(lovableKey));
    }

    console.log(`LLM Router initialized with ${this.providers.length} providers`);
  }

  private getProviderForModel(model: string): LLMProvider | null {
    for (const provider of this.providers) {
      if (provider.supportsModel(model)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Chat with automatic retries, circuit breaker, and fallback
   */
  async chat(req: LLMRequest): Promise<LLMResponse> {
    const modelsToTry = [req.model, ...this.fallbackModels.filter(m => m !== req.model)];
    
    for (const modelName of modelsToTry) {
      const provider = this.getProviderForModel(modelName);
      if (!provider) {
        console.warn(`No provider found for model: ${modelName}`);
        continue;
      }

      // Get provider identifier for circuit breaker
      const providerName = modelName.split('/')[0] || 'unknown';
      
      // Check circuit breaker
      if (globalCircuitBreaker.isOpen(providerName)) {
        console.warn(`Circuit breaker OPEN for ${providerName}, skipping model ${modelName}`);
        continue;
      }

      try {
        console.log(`Attempting model: ${modelName} (circuit: ${globalCircuitBreaker.getState(providerName)})`);
        const response = await retryWithBackoff(
          () => provider.chat({ ...req, model: modelName }),
          3,
          100
        );
        
        // Record success in circuit breaker
        globalCircuitBreaker.recordSuccess(providerName);
        
        // Log fallback usage
        if (modelName !== req.model) {
          console.warn(`Fallback: ${req.model} → ${modelName}`);
        }
        
        return response;
      } catch (error) {
        // Record failure in circuit breaker
        globalCircuitBreaker.recordFailure(providerName);
        
        console.error(`Model ${modelName} failed:`, error);
        
        // If this is the last model, throw
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw error;
        }
        
        // Otherwise, try next model
        console.log(`Trying fallback model...`);
      }
    }

  throw new Error('All models failed');
  }
}

/**
 * Helper: Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Parse SSE stream and yield text deltas
 */
async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
  provider: 'openai' | 'anthropic' | 'google'
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process line by line
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // Handle CRLF
        if (line.endsWith('\r')) {
          line = line.slice(0, -1);
        }

        // Skip empty lines and comments
        if (!line.trim() || line.startsWith(':')) {
          continue;
        }

        // Parse SSE data
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();

          // Handle [DONE] signal
          if (dataStr === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);

            // Extract text delta based on provider format
            let delta = '';
            
            if (provider === 'openai' || provider === 'google') {
              // OpenAI format (also used by Lovable AI/Gemini)
              delta = parsed.choices?.[0]?.delta?.content || '';
            } else if (provider === 'anthropic') {
              // Anthropic format
              if (parsed.type === 'content_block_delta') {
                delta = parsed.delta?.text || '';
              }
            }

            if (delta) {
              yield delta;
            }
          } catch (parseError) {
            // Incomplete JSON - put back in buffer and wait for more data
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    }

    // Final flush for any remaining buffered content
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            let delta = '';
            if (provider === 'openai' || provider === 'google') {
              delta = parsed.choices?.[0]?.delta?.content || '';
            } else if (provider === 'anthropic') {
              if (parsed.type === 'content_block_delta') {
                delta = parsed.delta?.text || '';
              }
            }
            if (delta) yield delta;
          } catch {
            // Ignore parse errors in final flush
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream chat completion tokens in real-time
 * Returns async generator of text deltas
 */
export async function* chatStream(opts: {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  messages: Message[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const {
    provider,
    model,
    messages,
    tools,
    temperature = 0.2,
    maxTokens,
    timeoutMs = 60000,
    signal,
  } = opts;

  console.log(`[chatStream] Starting stream for ${provider}/${model}`);

  // OpenAI streaming
  if (provider === 'openai') {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const modelName = model.replace('openai/', '');
    const isNewerModel = modelName.startsWith('gpt-5') || 
                         modelName.startsWith('o3') || 
                         modelName.startsWith('o4');

    const body: any = {
      model: modelName,
      messages,
      stream: true,
    };

    if (isNewerModel) {
      body.max_completion_tokens = maxTokens ?? 4096;
    } else {
      body.max_tokens = maxTokens ?? 4096;
      if (temperature !== undefined) {
        body.temperature = temperature;
      }
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal, // Pass abort signal to fetch
      },
      timeoutMs
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI stream failed (${response.status}): ${error}`);
    }

    if (!response.body) {
      throw new Error('OpenAI response body is null');
    }

    yield* parseSSE(response.body, 'openai');
    return;
  }

  // Anthropic streaming
  if (provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const modelName = model.replace('anthropic/', '');
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const body: any = {
      model: modelName,
      messages: conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: maxTokens ?? 4096,
      stream: true,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }
    if (temperature !== undefined) {
      body.temperature = temperature;
    }
    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal, // Pass abort signal to fetch
      },
      timeoutMs
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic stream failed (${response.status}): ${error}`);
    }

    if (!response.body) {
      throw new Error('Anthropic response body is null');
    }

    yield* parseSSE(response.body, 'anthropic');
    return;
  }

  // Google Gemini (via Lovable AI Gateway) streaming
  if (provider === 'google') {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const body: any = {
      model,
      messages,
      stream: true,
      max_tokens: maxTokens ?? 4096,
    };

    if (temperature !== undefined) {
      body.temperature = temperature;
    }
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const response = await fetchWithTimeout(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal, // Pass abort signal to fetch
      },
      timeoutMs
    );

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable workspace.');
      }
      throw new Error(`Lovable AI stream failed (${response.status}): ${error}`);
    }

    if (!response.body) {
      throw new Error('Lovable AI response body is null');
    }

    yield* parseSSE(response.body, 'google');
    return;
  }

  throw new Error(`Unsupported provider for streaming: ${provider}`);
}
