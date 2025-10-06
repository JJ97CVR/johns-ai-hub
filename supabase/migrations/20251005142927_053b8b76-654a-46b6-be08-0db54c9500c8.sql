-- Sprint 4: Performance Optimizations

-- 1. Add HNSW indexes for vector similarity search (much faster than default IVFFlat)
-- HNSW (Hierarchical Navigable Small World) provides better recall and performance

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS knowledge_base_embedding_idx;
DROP INDEX IF EXISTS learned_patterns_embedding_idx;

-- Create HNSW indexes for knowledge_base
CREATE INDEX knowledge_base_embedding_hnsw_idx 
ON knowledge_base 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create HNSW indexes for learned_patterns
CREATE INDEX learned_patterns_embedding_hnsw_idx 
ON learned_patterns 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add index on query_analytics for common queries
CREATE INDEX IF NOT EXISTS idx_query_analytics_user_created 
ON query_analytics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_analytics_conversation 
ON query_analytics(conversation_id, created_at DESC);

-- Add index on conversations for faster user queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
ON conversations(user_id, updated_at DESC);

-- Add index on messages for faster conversation retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at ASC);

COMMENT ON INDEX knowledge_base_embedding_hnsw_idx IS 'HNSW index for fast vector similarity search on knowledge base';
COMMENT ON INDEX learned_patterns_embedding_hnsw_idx IS 'HNSW index for fast vector similarity search on learned patterns';