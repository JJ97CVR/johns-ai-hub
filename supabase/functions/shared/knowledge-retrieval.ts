import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logInfo, logError } from './logger-utils.ts';

// Generate embedding for semantic search
export async function generateEmbedding(text: string): Promise<number[]> {
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
  
  if (!response.ok) throw new Error(`Failed to generate embedding: ${response.status}`);
  const data = await response.json();
  return data.data[0].embedding;
}

// Hash question for caching with improved normalization
async function hashQuestion(text: string): Promise<string> {
  // Remove punctuation, extra whitespace, lowercase for better cache matching
  // "Vad är Python?" and "vad är python" -> same hash
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\såäö]/g, '') // Remove punctuation, keep Swedish chars
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .trim();
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Retrieve relevant knowledge with RAG
// Sprint 2: Enhanced med mode-awareness och artikelnummer-boost
// Sprint 10: Added adaptive topK support
export async function retrieveRelevantKnowledge(
  query: string,
  opts: { mode?: 'fast' | 'auto' | 'extended'; partNo?: string | null; topK?: number } = {}
) {
  const mode = opts.mode ?? 'auto';
  const partNo = opts.partNo ?? null;
  const topK = opts.topK ?? (mode === 'fast' ? 2 : mode === 'extended' ? 8 : 3);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  // Helper: Trunkera text för fast-mode (~600 tecken ≈ 100 tokens)
  const limitText = (s: string) => 
    mode === 'fast' && s.length > 600 ? s.slice(0, 600) + '…' : s;
  
  // 1. Check cache first
  const questionHash = await hashQuestion(query);
  const { data: cachedResponse } = await supabase
    .from('response_cache')
    .select('*')
    .eq('question_hash', questionHash)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (cachedResponse && cachedResponse.confidence_score > 0.85) {
    await supabase
      .from('response_cache')
      .update({ times_served: cachedResponse.times_served + 1 })
      .eq('id', cachedResponse.id);
    
    return { 
      cached: true, 
      response: cachedResponse.cached_response,
      knowledge: [],
      patterns: [],
      orgFacts: [],
    };
  }
  
  // 2. Generate embedding and search
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    // Sprint 2 P3.8: Exact match boost för artikelnummer
    let knowledgeResults: any[] = [];
    
    if (partNo) {
      logInfo('knowledge-retrieval', `Artikelnummer-boost: ${partNo}`, { partNo, mode });
      
      // Query 1: Exact match på metadata->>oe_no
      const { data: exactOe } = await supabase
        .from('knowledge_base')
        .select('id, title, content, category, metadata, source')
        .filter('metadata->>oe_no', 'eq', partNo)
        .limit(3);
      
      if (exactOe && exactOe.length > 0) {
        knowledgeResults.push(
          ...exactOe.map(k => ({
            ...k,
            similarity: 1.0, // Exakt match = högsta similaritet
            content: limitText(k.content),
          }))
        );
        logInfo('knowledge-retrieval', `Hittade ${exactOe.length} exakta OE-träffar`, { partNo, count: exactOe.length });
      }
      
      // Query 2: Alt-nummer match (om inga OE-träffar)
      if (knowledgeResults.length === 0) {
        const { data: exactAlt } = await supabase
          .from('knowledge_base')
          .select('id, title, content, category, metadata, source')
          .contains('metadata', { alt_nos: [partNo] })
          .limit(3);
        
        if (exactAlt && exactAlt.length > 0) {
          knowledgeResults.push(
            ...exactAlt.map(k => ({
              ...k,
              similarity: 0.95, // Alt-nummer = nästan lika bra
              content: limitText(k.content),
            }))
          );
          logInfo('knowledge-retrieval', `Hittade ${exactAlt.length} alt-nummer-träffar`, { partNo, count: exactAlt.length });
        }
      }
      
      // Semantic fallback om för få exact matches
      if (knowledgeResults.length < 2) {
        const { data: semanticResults } = await supabase.rpc('match_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: 0.4,
          match_count: topK,
        });
        
        if (semanticResults) {
          // Merge och dedupliera (behåll exact matches)
          const existingIds = new Set(knowledgeResults.map(k => k.id));
          const newResults = semanticResults
            .filter((k: any) => !existingIds.has(k.id))
            .map((k: any) => ({ ...k, content: limitText(k.content) }));
          
          knowledgeResults.push(...newResults);
          logInfo('knowledge-retrieval', `Lade till ${newResults.length} semantiska träffar`, { count: newResults.length });
        }
      }
    } else {
      // Normal semantic search (ingen artikelnummer)
      const { data: semanticResults } = await supabase.rpc('match_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: 0.4,
        match_count: topK,
      });
      
      knowledgeResults = (semanticResults || []).map((k: any) => ({
        ...k,
        content: limitText(k.content),
      }));
    }
    
    // SPRINT 2: Parallelize pattern and org facts queries with adaptive topK
    const [patternResults, orgFacts] = await Promise.all([
      supabase.rpc('match_patterns', {
        query_embedding: queryEmbedding,
        match_threshold: 0.4,
        match_count: topK,
      }).then(r => r.data),
      supabase
        .from('organization_facts')
        .select('*')
        .order('confidence', { ascending: false })
        .limit(topK * 2) // More facts since they're lightweight
        .then(r => r.data)
    ]);
    
    return {
      cached: false,
      knowledge: knowledgeResults || [],
      patterns: patternResults || [],
      orgFacts: orgFacts || [],
    };
  } catch (error) {
    logError('knowledge-retrieval', 'RAG error', error instanceof Error ? error : new Error(String(error)), { query: query.slice(0, 100) });
    return { 
      cached: false, 
      knowledge: [], 
      patterns: [], 
      orgFacts: [] 
    };
  }
}
