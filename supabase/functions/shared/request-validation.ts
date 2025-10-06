// Request Validation - Authentication, authorization, and input validation
// Centralizes all security checks for the chat endpoint

import { checkRateLimitDB } from './rate-limiter-db.ts';
import { validateNoPII } from './pii-filter.ts';
import type { CorsHeaders } from './cors.ts';

export interface ValidationContext {
  req: Request;
  corsHeaders: CorsHeaders;
  requestId: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: {
    message: string;
    status: number;
    headers?: Record<string, string>;
  };
  data?: {
    user: any;
    userClient: any;
    body: any;
  };
}

/**
 * Validate request and perform all security checks
 */
export async function validateChatRequest(
  context: ValidationContext
): Promise<ValidationResult> {
  const { req, corsHeaders, requestId } = context;
  
  // 1. IP-based rate limiting
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  
  const ipLimit = await checkRateLimitDB(clientIP, 'ip', 300, 60);
  
  if (!ipLimit.allowed) {
    const resetAt = typeof ipLimit.resetAt === 'number' ? ipLimit.resetAt : ipLimit.resetAt.getTime();
    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
    console.warn(`[${requestId}] 🚫 IP rate limit exceeded: ${clientIP}`);
    return {
      valid: false,
      error: {
        message: 'Too many requests from this IP. Please try again in a minute.',
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) }
      }
    };
  }
  
  // 2. Parse and validate request body
  let body: any;
  try {
    body = await req.json();
  } catch (error) {
    return {
      valid: false,
      error: {
        message: 'Invalid JSON in request body',
        status: 400
      }
    };
  }
  
  const { conversationId, message, fileIds, model, mode = 'auto' } = body;
  
  // 3. Input validation
  if (!conversationId || typeof conversationId !== 'string') {
    return {
      valid: false,
      error: {
        message: 'Invalid conversation ID',
        status: 400
      }
    };
  }
  
  if (!message || typeof message !== 'string') {
    return {
      valid: false,
      error: {
        message: 'Message is required',
        status: 400
      }
    };
  }
  
  if (message.length > 10000) {
    return {
      valid: false,
      error: {
        message: 'Message too long (max 10,000 characters)',
        status: 400
      }
    };
  }
  
  // 4. PII detection
  const piiCheck = validateNoPII(message);
  if (!piiCheck.valid) {
    console.warn(`[${requestId}] PII detected in message:`, piiCheck.error);
    return {
      valid: false,
      error: {
        message: piiCheck.error || 'Message contains sensitive information',
        status: 400
      }
    };
  }
  
  // 5. Model validation
  const { isValidModel } = await import('./models-config.ts');
  
  if (model && !isValidModel(model)) {
    return {
      valid: false,
      error: {
        message: 'Invalid model specified',
        status: 400
      }
    };
  }
  
  // 6. File IDs validation
  if (fileIds && (!Array.isArray(fileIds) || fileIds.some((id: any) => typeof id !== 'string'))) {
    return {
      valid: false,
      error: {
        message: 'Invalid file IDs',
        status: 400
      }
    };
  }
  
  // 7. Authentication check
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return {
      valid: false,
      error: {
        message: 'Unauthorized',
        status: 401
      }
    };
  }
  
  // 8. Create user client and verify auth
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  
  if (authError || !user) {
    return {
      valid: false,
      error: {
        message: 'Invalid authentication',
        status: 401
      }
    };
  }
  
  // 9. User-based rate limiting
  const userLimit = await checkRateLimitDB(user.id, 'user', 100, 60);
  
  if (!userLimit.allowed) {
    const resetAt = typeof userLimit.resetAt === 'number' ? userLimit.resetAt : userLimit.resetAt.getTime();
    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
    console.warn(`[${requestId}] 🚫 User rate limit exceeded: ${user.id}`);
    return {
      valid: false,
      error: {
        message: 'You have exceeded your hourly message limit. Please try again later.',
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) }
      }
    };
  }
  
  // 10. Verify conversation ownership
  const { data: conversation, error: convError } = await userClient
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .single();
  
  if (convError || !conversation) {
    console.error(`[${requestId}] Conversation verification failed:`, convError);
    return {
      valid: false,
      error: {
        message: 'Access denied',
        status: 403
      }
    };
  }
  
  console.log(`[${requestId}] ✅ Request validation passed for user ${user.id}`);
  
  return {
    valid: true,
    data: {
      user,
      userClient,
      body,
    }
  };
}
