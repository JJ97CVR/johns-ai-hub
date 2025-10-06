-- Phase 1: AI Response Cache Table
-- Stores complete AI responses for ultra-fast retrieval

CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT UNIQUE NOT NULL,
  query_text TEXT NOT NULL,
  response_content TEXT NOT NULL,
  model TEXT NOT NULL,
  mode TEXT NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  hit_count INTEGER DEFAULT 1,
  confidence_score REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Indexes for fast lookups
CREATE INDEX idx_ai_cache_hash ON public.ai_response_cache(query_hash);
CREATE INDEX idx_ai_cache_expires ON public.ai_response_cache(expires_at);
CREATE INDEX idx_ai_cache_mode ON public.ai_response_cache(mode);

-- RLS: Service role manages cache
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to AI cache"
ON public.ai_response_cache
FOR ALL
USING (auth.role() = 'service_role');

-- Auto-cleanup of expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM ai_response_cache WHERE expires_at < NOW();
$$;

COMMENT ON TABLE public.ai_response_cache IS 'Caches complete AI responses for ultra-fast retrieval. Reduces 2-30s responses to 100-500ms on cache hits.';