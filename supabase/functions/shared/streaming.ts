// SSE Streaming - Real-time token streaming for chat responses
// Handles Server-Sent Events for progressive content delivery

import { chatStream } from './llm-router.ts';
import type { Message as LLMMessage, Citation } from './llm-router.ts';
import type { CorsHeaders } from './cors.ts';

export interface StreamConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  messages: LLMMessage[];
  requestId: string;
  conversationId: string;
  messageId: string;
  mode: string;
  corsHeaders: CorsHeaders;
  progressEvents?: string[];
}

/**
 * Create SSE response headers
 */
export function createSSEHeaders(corsHeaders: CorsHeaders): Record<string, string> {
  return {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };
}


/**
 * Stream chat response with SSE
 */
export async function streamChatResponse(
  req: Request,
  config: StreamConfig
): Promise<Response> {
  const { 
    provider, 
    model, 
    messages, 
    requestId, 
    conversationId, 
    messageId, 
    mode, 
    progressEvents
  } = config;
  
  const sseHeaders = createSSEHeaders(config.corsHeaders);
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (obj: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        
        // Abort handling
        const abortController = new AbortController();
        req.signal?.addEventListener('abort', () => {
          console.log(`[${requestId}] 🛑 Client aborted request`);
          try {
            abortController.abort();
            controller.close();
          } catch (e) {
            console.error(`[${requestId}] ⚠️  Error during abort:`, e);
          }
        });
        
        // Heartbeat to keep connection alive
        const heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            clearInterval(heartbeatTimer);
          }
        }, 15000);

        let streamedContent = '';
        const ttfbStart = Date.now();
        let ttfbMs = 0;
        let tokenCount = 0;

        try {
          // Send progress events
          if (progressEvents && progressEvents.length > 0) {
            for (const progress of progressEvents) {
              send({ progress });
            }
          }
          
          console.log(`[${requestId}] 🌊 Starting real token stream for ${provider}/${model}`);
          
          // Start streaming
          const stream = chatStream({
            provider,
            model,
            messages,
            tools: undefined,
            signal: abortController.signal,
          });
          
          for await (const token of stream) {
            if (tokenCount === 0) {
              ttfbMs = Date.now() - ttfbStart;
              console.log(`[${requestId}] ⚡ TTFB: ${ttfbMs}ms`);
            }
            
            streamedContent += token;
            tokenCount++;
            send({ delta: token });
          }
          
          console.log(`[${requestId}] ✅ Stream complete: ${tokenCount} tokens, ${streamedContent.length} chars`);
          
          // Send completion - CRITICAL FIX: Wrap messageId in metadata
          send({
            done: true,
            metadata: {
              messageId,
              conversationId,
              mode,
              model: `${provider}/${model}`,
              stats: {
                tokens: tokenCount,
                ttfbMs,
                totalMs: Date.now() - ttfbStart,
              }
            }
          });
          
          clearInterval(heartbeatTimer);
          controller.close();
          
        } catch (error) {
          clearInterval(heartbeatTimer);
          console.error(`[${requestId}] ❌ Streaming error:`, error);
          
          try {
            send({ 
              error: error instanceof Error ? error.message : 'Stream error',
              partialContent: streamedContent 
            });
          } catch {
            // Controller already closed
          }
          
          controller.close();
        }
      }
    }),
    { headers: sseHeaders }
  );
}

/**
 * Stream cached response with simulated token delivery
 */
export function streamCachedResponse(
  cachedContent: string,
  messageId: string,
  conversationId: string,
  mode: string,
  corsHeaders: CorsHeaders
): Response {
  const sseHeaders = {
    ...createSSEHeaders(corsHeaders),
    // SPRINT 2: Add CDN caching for cached responses
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'CDN-Cache-Control': 'public, max-age=86400',
    'Vary': 'Accept-Encoding',
  };
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Stream cached content in chunks
        const chunkSize = 10;
        for (let i = 0; i < cachedContent.length; i += chunkSize) {
          const chunk = cachedContent.slice(i, i + chunkSize);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }
        
        // Send completion with metadata - CRITICAL FIX: Wrap in metadata
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          done: true,
          metadata: {
            messageId,
            conversationId,
            cached: true,
            mode,
            model: 'cache',
          }
        })}\n\n`));
        
        controller.close();
      }
    }),
    { headers: sseHeaders }
  );
}
