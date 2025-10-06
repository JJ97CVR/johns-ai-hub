import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logError } from '../shared/logger-utils.ts';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean);

type CorsHeaders = {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': string;
  [key: string]: string;
};

const getCorsHeaders = (req: Request): CorsHeaders => {
  const origin = req.headers.get('Origin') ?? '';
  
  // SECURITY: Strict CORS validation - deny if origin not whitelisted
  if (ALLOWED_ORIGINS.length === 0) {
    logError('download-file', 'ALLOWED_ORIGINS not configured');
    return {
      'Access-Control-Allow-Origin': '',
      'Access-Control-Allow-Headers': '',
      'Access-Control-Allow-Credentials': '',
    };
  }
  
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': '',
      'Access-Control-Allow-Headers': '',
      'Access-Control-Allow-Credentials': '',
    };
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    
    if (!fileId) {
      return new Response(
        JSON.stringify({ error: 'Missing fileId parameter' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // SECURITY: Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create client with user's token for RLS verification
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // SECURITY: Verify user owns the file via conversation (RLS enforces this)
    const { data: file, error } = await userClient
      .from('uploaded_files')
      .select('storage_path, filename, conversations!inner(user_id)')
      .eq('id', fileId)
      .single();
    
    if (error || !file) {
      logError('download-file', 'File access denied', error, { fileId });
      return new Response(
        JSON.stringify({ error: 'File not found or access denied' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use service role to generate signed URL
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Generate signed URL with 5 minute expiry
    const { data: signedUrlData, error: signError } = await supabaseAdmin.storage
      .from('chat-files')
      .createSignedUrl(file.storage_path, 300); // 5 min TTL
    
    if (signError || !signedUrlData) {
      logError('download-file', 'Failed to generate signed URL', signError, { fileId, storagePath: file.storage_path });
      return new Response(
        JSON.stringify({ error: 'Could not generate download URL' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        url: signedUrlData.signedUrl,
        filename: file.filename,
        expiresIn: 300 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    logError('download-file', 'Download URL generation error', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
