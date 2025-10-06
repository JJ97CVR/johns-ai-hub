import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SECURITY: Strict CORS - only allow whitelisted origins
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean);

type CorsHeaders = {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': string;
  [key: string]: string;
};

const getCorsHeaders = (req: Request): CorsHeaders => {
  const origin = req.headers.get('Origin') ?? '';
  
  // CRITICAL: Deny if ALLOWED_ORIGINS not configured or origin not whitelisted
  if (ALLOWED_ORIGINS.length === 0) {
    console.error('ALLOWED_ORIGINS not configured - requests will be denied');
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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB server-side limit

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const conversationId = formData.get('conversationId') as string;
    
    if (!file || !conversationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // SECURITY: Verify user owns the conversation
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create client with user's token for authorization
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Verify conversation ownership (RLS enforces this)
    const { data: conversation, error: convError } = await userClient
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();
    
    if (convError || !conversation) {
      console.error('Conversation verification failed:', convError);
      return new Response(
        JSON.stringify({ error: 'Access denied' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // SECURITY: File validation
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File too large (max 50MB)' }), 
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extra security: validate buffer size
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File too large (max 50MB)' }), 
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Recreate File object from buffer for consistent processing
    const validatedFile = new File([buffer], file.name, { type: file.type });
    
    // Validate MIME type
    const allowedTypes = [
      'text/csv', 
      'application/json', 
      'text/plain', 
      'text/x-python',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (file.type && !allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Use service role for storage operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 1. Upload to Storage
    const filename = `${Date.now()}_${sanitizedName}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('chat-files')
      .upload(filename, validatedFile);
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Upload failed' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 2. Get storage path (bucket is now private, no public URL)
    const storagePath = filename;
    
    // 3. Parse file content based on type
    const fileType = getFileType(file.name);
    let parsedData = null;
    let contentPreview = null;
    
    try {
      if (fileType === 'csv') {
        const text = await validatedFile.text();
        contentPreview = text.slice(0, 1000);
        // Secure CSV parsing - avoid CSV injection
        parsedData = parseCSV(text);
      } else if (fileType === 'json') {
        const text = await validatedFile.text();
        contentPreview = text.slice(0, 1000);
        parsedData = JSON.parse(text);
      } else if (fileType === 'python' || fileType === 'text') {
        contentPreview = await validatedFile.text().then(t => t.slice(0, 1000));
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Continue anyway, file is uploaded
    }
    
    // 4. Save metadata to database
    const { data: fileRecord, error: dbError } = await supabaseClient
      .from('uploaded_files')
      .insert({
        conversation_id: conversationId,
        filename: sanitizedName,
        file_type: fileType,
        file_size: validatedFile.size,
        storage_path: storagePath,
        content_preview: contentPreview,
        parsed_data: parsedData,
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to save file metadata' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(fileRecord),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Upload error:`, error);
    return new Response(
      JSON.stringify({ error: 'Upload failed', errorId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (['xlsx', 'xls'].includes(ext || '')) return 'excel';
  if (ext === 'json') return 'json';
  if (ext === 'py') return 'python';
  if (['png', 'jpg', 'jpeg'].includes(ext || '')) return 'image';
  if (ext === 'txt') return 'text';
  return 'unknown';
}

function parseCSV(text: string) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;
  
  // Basic CSV parsing - sanitize to prevent CSV injection
  const sanitizeCell = (cell: string) => {
    // Remove dangerous formula characters
    return cell.replace(/^[=+\-@]/, '').trim();
  };
  
  const headers = lines[0].split(',').map(h => sanitizeCell(h));
  const rows = lines.slice(1, Math.min(11, lines.length)).map(line => {
    const values = line.split(',');
    return headers.reduce((obj: any, header, i) => {
      obj[header] = sanitizeCell(values[i] || '');
      return obj;
    }, {});
  });
  
  return {
    headers,
    rowCount: lines.length - 1,
    preview: rows,
  };
}
