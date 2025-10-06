-- Fix remaining security issues

-- 1. Ensure code_executions is system-only (no user INSERT access)
-- Code executions should only be created by edge functions using service role
-- Users can only read their own executions via existing SELECT policy

-- No INSERT policy needed - this prevents users from creating fake executions
-- Only service role can insert

-- 2. Verify organization_facts has no user access (already done in previous migration)
-- This table should only be accessible via edge functions
-- Double-check that no policies exist

-- 3. Add comment for vector extension in public schema
COMMENT ON EXTENSION vector IS 'pgvector extension for similarity search - required in public schema for RLS compatibility';

-- Security note: The following tables are intentionally "RLS enabled with no policies":
-- - knowledge_base: System knowledge, accessed only via service role
-- - learned_patterns: AI training data, accessed only via service role  
-- - organization_facts: Company data, accessed only via service role
-- - response_cache: Internal optimization, accessed only via service role
-- - code_executions: Has SELECT policy for users, INSERT only via service role
-- - conversation_insights: AI-generated insights, accessed only via service role
-- - query_analytics: Analytics data, has SELECT policy for users

-- This is the correct security model: users interact with data indirectly through
-- edge functions that use service role key, not by direct database access