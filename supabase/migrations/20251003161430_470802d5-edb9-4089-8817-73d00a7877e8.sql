-- Fix: Remove direct user access to system-level knowledge tables
-- These tables should only be accessible via edge functions using service role key

-- 1. Remove authenticated user access from knowledge_base
DROP POLICY IF EXISTS "Authenticated users can read knowledge" ON public.knowledge_base;

-- Knowledge base is now only accessible via service role (edge functions)
-- No direct user access needed - users interact through AI chat

-- 2. Remove authenticated user access from organization_facts
DROP POLICY IF EXISTS "Authenticated users can read org facts" ON public.organization_facts;

-- Organization facts are system-level data accessed only by AI

-- 3. Remove authenticated user access from learned_patterns
DROP POLICY IF EXISTS "Authenticated users can read patterns" ON public.learned_patterns;

-- Learned patterns are AI training data, not for direct user access

-- 4. Remove authenticated user access from response_cache
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.response_cache;

-- Response cache is an internal optimization, not for direct user queries

-- These tables are now "closed by default" with RLS enabled
-- Only service role (used by edge functions) can access them
-- Users interact with this knowledge indirectly through the AI chat interface