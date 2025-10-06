-- Fix organization_facts security: Restrict read access to admin/owner only
-- Drop the overly permissive policy that allows all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can read org facts" ON organization_facts;

-- Create a secure policy that only allows admins and owners to read organization facts
CREATE POLICY "Only admins and owners can read org facts"
ON organization_facts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role)
);