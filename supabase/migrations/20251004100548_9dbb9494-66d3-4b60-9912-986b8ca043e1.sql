-- Fix response_cache security: Remove broad authenticated user read access
-- This table is a system-level cache that should only be accessed by backend functions
-- Drop the overly permissive policy that allows all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can read cache" ON response_cache;

-- No new SELECT policy needed - only service role (backend functions) should access this table
-- The existing INSERT/UPDATE/DELETE policies already restrict to service_role only