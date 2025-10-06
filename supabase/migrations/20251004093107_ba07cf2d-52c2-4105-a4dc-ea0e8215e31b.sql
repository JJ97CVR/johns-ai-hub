-- Performance indexes for faster queries and RAG operations

-- 1. pgvector HNSW index for semantic search (faster than IVFFlat)
-- This dramatically improves knowledge base search performance
CREATE INDEX IF NOT EXISTS kb_embeddings_hnsw 
ON knowledge_base 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. Index for learned patterns similarity search
CREATE INDEX IF NOT EXISTS patterns_embeddings_hnsw
ON learned_patterns
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. Fast message retrieval by conversation
CREATE INDEX IF NOT EXISTS messages_conv_time_idx 
ON messages (conversation_id, created_at DESC);

-- 4. Fast conversation listing for users
CREATE INDEX IF NOT EXISTS conv_user_time_idx 
ON conversations (user_id, updated_at DESC);

-- 5. Analytics query optimization
CREATE INDEX IF NOT EXISTS analytics_user_created_idx
ON query_analytics (user_id, created_at DESC);

-- 6. File retrieval optimization
CREATE INDEX IF NOT EXISTS files_conv_idx
ON uploaded_files (conversation_id, created_at DESC);

-- 7. Code execution lookups
CREATE INDEX IF NOT EXISTS code_exec_message_idx
ON code_executions (message_id);

-- Update statistics for query planner
ANALYZE knowledge_base;
ANALYZE learned_patterns;
ANALYZE messages;
ANALYZE conversations;
ANALYZE query_analytics;