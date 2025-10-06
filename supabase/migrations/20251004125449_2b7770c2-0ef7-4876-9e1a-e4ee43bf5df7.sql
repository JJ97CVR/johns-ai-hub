-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to learned_patterns
ALTER TABLE learned_patterns 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding columns to conversation_insights
ALTER TABLE conversation_insights 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Verify knowledge_base has embedding (should already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'knowledge_base' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE knowledge_base ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- Add IVFFLAT indexes for fast vector search
CREATE INDEX IF NOT EXISTS learned_patterns_embedding_idx 
ON learned_patterns USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS conversation_insights_embedding_idx 
ON conversation_insights USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);