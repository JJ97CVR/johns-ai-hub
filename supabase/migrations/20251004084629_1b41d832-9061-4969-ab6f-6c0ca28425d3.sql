-- Add explicit "system-only" policies to system tables
-- These tables are managed by edge functions via service role
-- These policies satisfy security scanners and document intent

-- Code Executions: System manages writes via service role
CREATE POLICY "System manages code executions"
ON public.code_executions
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Conversation Insights: System manages all writes via service role
CREATE POLICY "System manages conversation insights inserts"
ON public.conversation_insights
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "System manages conversation insights updates"
ON public.conversation_insights
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "System manages conversation insights deletes"
ON public.conversation_insights
FOR DELETE
TO authenticated
USING (false);

-- Query Analytics: System manages writes via service role
CREATE POLICY "System manages query analytics"
ON public.query_analytics
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Learned Patterns: System manages writes via service role (read-only policy already exists)
CREATE POLICY "System manages learned patterns inserts"
ON public.learned_patterns
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "System manages learned patterns updates"
ON public.learned_patterns
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "System manages learned patterns deletes"
ON public.learned_patterns
FOR DELETE
TO authenticated
USING (false);

-- Response Cache: System manages writes via service role (read-only policy already exists)
CREATE POLICY "System manages response cache inserts"
ON public.response_cache
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "System manages response cache updates"
ON public.response_cache
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "System manages response cache deletes"
ON public.response_cache
FOR DELETE
TO authenticated
USING (false);