import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Secure CORS - only allow specific origins
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean);
const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

async function generateEmbedding(text: string): Promise<number[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) throw new Error('OPENAI_API_KEY not configured');
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI embeddings error:', error);
    throw new Error(`Failed to generate embedding: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin or owner role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    const { data: isOwner } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'owner'
    });

    if (!isAdmin && !isOwner) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Only admins and owners can seed knowledge.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initial organization facts
    const facts = [
      {
        fact_type: 'database_path',
        key: 'volvo_production_db',
        value: '/Volumes/T9/textfix/volvo_production.db',
        description: 'Main Volvo production database',
      },
      {
        fact_type: 'database_path',
        key: 'ultimate_oe_db',
        value: '/Volumes/T9/textfix/ultimate_oe_v4.db',
        description: 'OE family normalization database',
      },
      {
        fact_type: 'csv_location',
        key: 'reference_data',
        value: '/Volumes/T9/textfix/',
        description: 'Folder containing reference CSVs',
      },
      {
        fact_type: 'process',
        key: 'translation_workflow',
        value: 'Use expert_system.py for batch translation with GPT-4o',
        description: 'Standard translation process',
      },
      {
        fact_type: 'team_info',
        key: 'product_count',
        value: '161506',
        description: 'Total number of Volvo products in database',
      },
    ];
    
    for (const fact of facts) {
      const { error } = await supabase.from('organization_facts').upsert({
        ...fact,
        confidence: 1.0,
        source: 'manual_seed',
      });
      if (error) console.error('Error inserting fact:', error);
    }
    
    // Initial knowledge base items
    const knowledgeItems = [
      {
        title: 'Volvo Parts Translation System',
        content: `The system translates English Volvo part names to Swedish automotive terminology. 
        It uses GPT-4o for translation, pattern learning, and maintains a database of 161,506+ products. 
        Key components: expert_system.py (RAG learning), ultimate_oe_family_v4_fixed.py (OE normalization), 
        self_learning_verifier.py (pattern-based caching).`,
        category: 'system_overview',
      },
      {
        title: 'Swedish Automotive Terms',
        content: `Common translations: brake disc=bromsskiva, bushing=bussning, oil filter=oljefilter, 
        suspension=fjädring, steering=styrning. Position terms: front=fram, rear=bak, left=vänster, 
        right=höger. Always preserve technical specs like voltage (12V), thread size (M10x1.5), and OE numbers.`,
        category: 'translation_rules',
      },
      {
        title: 'Database Schema',
        content: `Main tables: products (product_id, oe_nummer, skandix_name_eng, swedish_translation), 
        oe_normalizations (oe_family, normalized, confidence), smart_translations (cached AI translations). 
        Use vector search for similarity matching.`,
        category: 'technical_docs',
      },
    ];
    
    for (const item of knowledgeItems) {
      const embedding = await generateEmbedding(`${item.title} ${item.content}`);
      
      const { error } = await supabase.from('knowledge_base').insert({
        ...item,
        embedding,
        source: 'manual_seed',
      });
      if (error) console.error('Error inserting knowledge:', error);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        seeded: facts.length + knowledgeItems.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Seed error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
