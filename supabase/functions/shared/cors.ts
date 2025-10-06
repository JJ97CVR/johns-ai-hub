// CORS Configuration and Headers Management
// Handles strict origin validation and CORS header generation

export type CorsHeaders = {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': string;
  [key: string]: string;
};

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean);

/**
 * Generate CORS headers with strict origin validation
 * SECURITY: Only whitelisted origins are allowed in production
 */
export const getCorsHeaders = (req: Request): CorsHeaders => {
  const origin = req.headers.get('Origin') ?? '';
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
  const allowAllInDev = isDevelopment && ALLOWED_ORIGINS.length === 0;
  
  const base: CorsHeaders = {
    'Access-Control-Allow-Origin': '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  
  // DEV: Allow all if no whitelist configured
  if (allowAllInDev) {
    console.warn('⚠️  DEV MODE: ALLOWED_ORIGINS not set - allowing all origins');
    return { ...base, 'Access-Control-Allow-Origin': origin || '*' };
  }
  
  // PROD: Block if no whitelist
  if (ALLOWED_ORIGINS.length === 0) {
    console.error('🚨 SECURITY: ALLOWED_ORIGINS not configured - blocking');
    return base; // Empty origin = blocked
  }
  
  // SECURITY FIX: No Origin header requires internal auth key
  if (!origin) {
    const internalKey = req.headers.get('X-Internal-Auth');
    const secret = Deno.env.get('INTERNAL_BACKEND_KEY');
    if (internalKey && secret && internalKey === secret) {
      console.log('✅ Server-to-server authenticated with internal key');
      return { ...base, 'Access-Control-Allow-Origin': '*' };
    }
    console.warn('🚫 CORS BLOCKED: No Origin and missing/invalid X-Internal-Auth');
    return base; // No wildcard without auth
  }
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    console.log(`✅ CORS allowed: ${origin}`);
    return { ...base, 'Access-Control-Allow-Origin': origin };
  }
  
  console.warn(`🚫 CORS BLOCKED: "${origin}" not in whitelist: ${ALLOWED_ORIGINS.join(', ')}`);
  return base;
};
