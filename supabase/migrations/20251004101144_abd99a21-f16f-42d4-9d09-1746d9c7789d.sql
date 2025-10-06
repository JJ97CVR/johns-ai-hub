-- Fix query_analytics INSERT policy to allow proper logging
-- Currently blocks all inserts with "WITH CHECK: false"

-- 1. Drop the blocking INSERT policy
DROP POLICY IF EXISTS "System manages query analytics" ON query_analytics;

-- 2. Create proper INSERT policies

-- Allow service role (Edge Functions) to insert analytics
CREATE POLICY "query_analytics_insert_service_role"
ON query_analytics FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to insert analytics for their own conversations
CREATE POLICY "query_analytics_insert_owner"
ON query_analytics FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = query_analytics.conversation_id
      AND c.user_id = auth.uid()
  )
);

-- 3. Add performance indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_query_analytics_user 
  ON query_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_query_analytics_conv 
  ON query_analytics(conversation_id);

CREATE INDEX IF NOT EXISTS idx_query_analytics_created 
  ON query_analytics(created_at DESC);

-- Note: Foreign key CASCADE was already fixed in previous migration