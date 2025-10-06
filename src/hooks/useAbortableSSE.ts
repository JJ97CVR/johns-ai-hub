import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { retryWithBackoff, isRetryableError } from '@/lib/retry';

// TypeScript type improvements
export interface Citation {
  title: string;
  url: string;
}

export interface SSEMetadata {
  messageId?: string;
  conversationId?: string;
  citations?: Citation[];
  toolsUsed?: string[];
  model?: string;
  mode?: string;
  cached?: boolean;
  stats?: {
    tokens?: number;
    ttfbMs?: number;
    totalMs?: number;
  };
}

export interface SSEMessage {
  delta?: string;
  done?: boolean;
  error?: string;
  progress?: string;
  metadata?: SSEMetadata;
}

export interface UseAbortableSSEOptions {
  onDelta: (text: string) => void;
  onProgress?: (status: string) => void;
  onDone: (metadata?: SSEMetadata) => void;
  onError: (error: string) => void;
}

export function useAbortableSSE() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (
    conversationId: string,
    message: string,
    fileIds: string[] = [],
    mode: string = 'auto',
    options: UseAbortableSSEOptions,
    model?: string,
  ) => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Retry network requests with exponential backoff
      const response = await retryWithBackoff(
        async () => {
          return await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                conversationId,
                message,
                fileIds,
                mode,
                model,
              }),
              signal: controller.signal,
            }
          );
        },
        {
          maxRetries: 2,
          baseDelay: 1000,
          onRetry: (attempt, error) => {
            console.log(`🔄 Retry attempt ${attempt} after error:`, error.message);
            options.onProgress?.(`Försöker igen (${attempt}/2)...`);
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';

        for (let line of lines) {
          line = line.trim();
          
          // Skip empty lines and heartbeats
          if (!line || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              options.onDone();
              continue;
            }

            try {
              const parsed: SSEMessage = JSON.parse(data);
              
              if (parsed.error) {
                options.onError(parsed.error);
                break;
              }
              
              if (parsed.progress) {
                options.onProgress?.(parsed.progress);
              }
              
              if (parsed.delta) {
                options.onDelta(parsed.delta);
              }
              
              if (parsed.done && parsed.metadata) {
                options.onDone(parsed.metadata);
              }
            } catch (e) {
              console.warn('Failed to parse SSE message:', data);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        // Check if error is retryable
        const retryable = isRetryableError(error);
        options.onError(
          retryable 
            ? `${error.message || 'Stream failed'} (försök igen)`
            : error.message || 'Stream failed'
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  return {
    startStream,
    stopStream,
    isStreaming,
  };
}

