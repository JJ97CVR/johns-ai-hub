-- Fix user_roles RLS: Convert SELECT policies from RESTRICTIVE to PERMISSIVE
-- Problem: Multiple RESTRICTIVE policies are ANDed together, causing conflicts
-- Solution: Use PERMISSIVE policies (ORed together) with one RESTRICTIVE auth check

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Recreate as PERMISSIVE policies (default, will be ORed together)
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
AS PERMISSIVE
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
AS PERMISSIVE
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- The existing RESTRICTIVE policy "user_roles_require_auth_restrictive" ensures authentication
-- Final logic: ((own roles) OR (admin sees all)) AND (authenticated)
-- Regular users: Can only see their own roles
-- Admins/owners: Can see all roles
-- Unauthenticated: Cannot see anything