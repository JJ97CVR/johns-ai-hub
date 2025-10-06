-- Fix knowledge_base security: Restrict read access to admin/owner only
-- Drop the overly permissive policy that allows all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can read knowledge base" ON knowledge_base;

-- Create a secure policy that only allows admins and owners to read knowledge
CREATE POLICY "Only admins and owners can read knowledge base"
ON knowledge_base FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role)
);