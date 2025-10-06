-- CRITICAL: Remove overly permissive storage SELECT policy
-- This policy allows ANY authenticated user to read ALL files in chat-files bucket
DROP POLICY IF EXISTS "Users can view files" ON storage.objects;

-- Verify only restrictive policies remain (from later migrations)
-- These policies check conversation ownership via uploaded_files table

-- HIGH: Protect knowledge stats with role check
-- Only admin/owner can view system statistics
CREATE POLICY "Only admins can access knowledge stats"
ON query_analytics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Add index for better performance on role checks
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role 
ON user_roles(user_id, role);