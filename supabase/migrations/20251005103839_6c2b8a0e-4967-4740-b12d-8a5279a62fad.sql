-- ============================================================
-- FAS 4: PERFORMANCE OPTIMIZATION - DATABASE INDEXES
-- Expected Impact: RAG search 500ms → 200ms (2.5x faster)
-- ============================================================

-- 1. Upgrade to HNSW index on knowledge_base (10x faster than IVFFLAT)
DROP INDEX IF EXISTS knowledge_base_embedding_idx;
CREATE INDEX knowledge_base_embedding_idx 
ON knowledge_base 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. Covering index for messages (avoid table lookups in conversation history)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_covering 
ON messages(conversation_id, created_at DESC) 
INCLUDE (role, content);

-- 3. Covering index for cache lookups (faster cache hits)
CREATE INDEX IF NOT EXISTS idx_cache_lookup 
ON response_cache(question_hash, confidence_score, expires_at) 
INCLUDE (cached_response);

-- 4. Index for rate limiting cleanup (removed WHERE clause due to immutability)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup 
ON rate_limits(window_start);

-- 5. Ensure learned_patterns uses HNSW index
DROP INDEX IF EXISTS learned_patterns_embedding_idx;
CREATE INDEX learned_patterns_embedding_idx 
ON learned_patterns 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 6. Ensure conversation_insights uses HNSW index
DROP INDEX IF EXISTS conversation_insights_embedding_idx;
CREATE INDEX conversation_insights_embedding_idx 
ON conversation_insights 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);