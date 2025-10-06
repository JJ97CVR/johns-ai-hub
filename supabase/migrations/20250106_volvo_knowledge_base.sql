CREATE TABLE volvo_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  oe_nummer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX volvo_embedding_idx ON volvo_knowledge_base 
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX volvo_oe_idx ON volvo_knowledge_base(oe_nummer);

ALTER TABLE volvo_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON volvo_knowledge_base FOR SELECT USING (true);

CREATE FUNCTION search_volvo_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 5
) RETURNS TABLE (
  id UUID, title TEXT, content TEXT, 
  oe_nummer TEXT, metadata JSONB, similarity FLOAT
) AS $$
  SELECT id, title, content, oe_nummer, metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM volvo_knowledge_base
  WHERE 1 - (embedding <=> query_embedding) > 0.7
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql;