-- Add SELECT policy for response_cache that allows only service role
-- This is a system-level cache accessed only by backend Edge Functions
-- Regular users should never read this table directly - they get responses via Edge Functions

CREATE POLICY "response_cache_select_service_role"
ON response_cache FOR SELECT
USING (auth.role() = 'service_role');

-- Note: Service role bypasses RLS anyway, but this policy documents the intended access pattern
-- and makes the security model explicit