-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. KNOWLEDGE BASE (organisationens dokumentation)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT, -- 'manual', 'conversation', 'file_upload', 'web'
  category TEXT, -- 'volvo_parts', 'process', 'policy', 'faq'
  metadata JSONB,
  embedding vector(1536), -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  confidence_score REAL DEFAULT 1.0
);

-- 2. LEARNED PATTERNS (AI lär sig från konversationer)
CREATE TABLE learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_pattern TEXT NOT NULL,
  answer_template TEXT NOT NULL,
  example_questions TEXT[],
  usage_count INTEGER DEFAULT 1,
  success_rate REAL DEFAULT 1.0,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CONVERSATION INSIGHTS (vad diskuterades)
CREATE TABLE conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  key_points TEXT[],
  entities JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CACHED RESPONSES (snabba svar på vanliga frågor)
CREATE TABLE response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT UNIQUE NOT NULL,
  question_text TEXT NOT NULL,
  cached_response TEXT NOT NULL,
  context_used JSONB,
  times_served INTEGER DEFAULT 0,
  confidence_score REAL DEFAULT 1.0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORGANIZATION FACTS (specifika fakta om er organisation)
CREATE TABLE organization_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  source TEXT,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fact_type, key)
);

-- 6. QUERY ANALYTICS (förstå användarmönster)
CREATE TABLE query_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  conversation_id UUID REFERENCES conversations(id),
  query TEXT NOT NULL,
  query_type TEXT,
  response_quality INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  knowledge_used TEXT[],
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES för vector similarity search
CREATE INDEX idx_knowledge_embedding ON knowledge_base 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_patterns_embedding ON learned_patterns 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_insights_embedding ON conversation_insights 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- INDEXES för snabb lookup
CREATE INDEX idx_response_cache_hash ON response_cache(question_hash);
CREATE INDEX idx_org_facts_lookup ON organization_facts(fact_type, key);
CREATE INDEX idx_knowledge_category ON knowledge_base(category);
CREATE INDEX idx_query_analytics_user ON query_analytics(user_id);
CREATE INDEX idx_query_analytics_conversation ON query_analytics(conversation_id);

-- Function för vector similarity search i knowledge base
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM knowledge_base
  WHERE 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function för pattern matching
CREATE OR REPLACE FUNCTION match_patterns(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  question_pattern text,
  answer_template text,
  usage_count int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    learned_patterns.id,
    learned_patterns.question_pattern,
    learned_patterns.answer_template,
    learned_patterns.usage_count,
    1 - (learned_patterns.embedding <=> query_embedding) as similarity
  FROM learned_patterns
  WHERE 1 - (learned_patterns.embedding <=> query_embedding) > match_threshold
  ORDER BY learned_patterns.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enable RLS on all new tables
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (alla användare kan läsa, endast system kan skriva)
CREATE POLICY "Anyone can read knowledge" ON knowledge_base FOR SELECT USING (true);
CREATE POLICY "Anyone can read patterns" ON learned_patterns FOR SELECT USING (true);
CREATE POLICY "Anyone can read org facts" ON organization_facts FOR SELECT USING (true);
CREATE POLICY "Anyone can read cache" ON response_cache FOR SELECT USING (true);

CREATE POLICY "Users can view their analytics" ON query_analytics 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view insights from their conversations" ON conversation_insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = conversation_insights.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );