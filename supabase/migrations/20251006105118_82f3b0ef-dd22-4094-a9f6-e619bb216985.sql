-- Fix RLS: Add explicit authentication requirements (defense-in-depth)
-- Issue: Scanner detected tables without explicit auth checks, allowing potential public access
-- Solution: Add RESTRICTIVE policies requiring authentication

-- 1. feature_flags: Prevent public access to roadmap information
CREATE POLICY "feature_flags_require_auth"
ON public.feature_flags
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- 2. structured_logs: Prevent public access to system error information
CREATE POLICY "structured_logs_require_auth"
ON public.structured_logs
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- 3. analytics_queue: Prevent public access to user behavior data
CREATE POLICY "analytics_queue_require_auth"
ON public.analytics_queue
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- 4. ai_response_cache: Prevent public access to AI queries and responses
CREATE POLICY "ai_response_cache_require_auth"
ON public.ai_response_cache
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- 5. rate_limits: Prevent public access to rate limiting strategy
CREATE POLICY "rate_limits_require_auth"
ON public.rate_limits
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- 6. loop_checkpoints: Prevent public access to system state information
CREATE POLICY "loop_checkpoints_require_auth"
ON public.loop_checkpoints
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Note: These RESTRICTIVE policies are ANDed with existing PERMISSIVE policies
-- This ensures that BOTH conditions must be true:
-- 1. User must be authenticated (new RESTRICTIVE policy)
-- 2. User must meet existing access criteria (existing PERMISSIVE policies)
-- 
-- Service role bypasses RLS entirely, so edge functions continue to work normally