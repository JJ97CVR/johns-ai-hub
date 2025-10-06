/**
 * Sprint 3: Seed Parts Edge Function
 * CSV-baserat seed-script för Volvo artikelnummer till knowledge base
 * 
 * POST med CSV i body (format: oe_no,alt_nos,title,content,source,models)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parse } from 'https://deno.land/std@0.224.0/csv/parse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🌱 Starting seed-parts process...');
    
    // Environment check
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse CSV from request body
    const text = await req.text();
    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Empty CSV data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const rows = parse(text, { skipFirstRow: false }) as string[][];
    const [header, ...data] = rows;
    
    console.log(`📊 Parsed ${data.length} rows from CSV`);
    
    // Column mapping
    const col = (name: string) => {
      const idx = header.indexOf(name);
      if (idx === -1) throw new Error(`Missing required column: ${name}`);
      return idx;
    };

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      
      try {
        // Validate required fields
        const oe_no = r[col('oe_no')]?.trim();
        const title = r[col('title')]?.trim();
        const content = r[col('content')]?.trim();
        
        if (!oe_no || !title || !content) {
          throw new Error(`Row ${i + 2}: Missing required fields (oe_no, title, content)`);
        }
        
        // Parse JSON fields
        const alt_nos = JSON.parse(r[col('alt_nos')] || '[]');
        const models = JSON.parse(r[col('models')] || '[]');
        const source = r[col('source')]?.trim() || null;
        
        // Generate embedding
        console.log(`🔄 Generating embedding for: ${title}`);
        const embeddingText = `${title} ${content}`;
        
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: embeddingText,
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error(`Embedding API returned ${embeddingResponse.status}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;
        
        // Metadata
        const metadata = {
          oe_no,
          alt_nos,
          models,
          category: 'volvo_classic_parts',
          seeded_at: new Date().toISOString(),
        };

        // Upsert to knowledge_base
        const { error: upsertError } = await supabase
          .from('knowledge_base')
          .upsert({
            title,
            content,
            source,
            metadata,
            embedding,
            category: 'volvo_parts',
            confidence_score: 1.0,
          }, {
            onConflict: 'title', // Uppdatera om title redan finns
          });

        if (upsertError) {
          throw upsertError;
        }

        successCount++;
        console.log(`✅ [${i + 2}/${data.length + 1}] ${title}`);
        
      } catch (error) {
        errorCount++;
        const errMsg = `Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errMsg);
        console.error(`❌ ${errMsg}`);
      }
    }

    console.log(`🎉 Seed completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: data.length,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Seed process failed:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
