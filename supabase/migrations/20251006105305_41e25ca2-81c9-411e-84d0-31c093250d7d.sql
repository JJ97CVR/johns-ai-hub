-- Fix user_roles public exposure: Add explicit denial for unauthenticated users
-- Issue: Scanner detects user_roles as publicly readable despite existing RESTRICTIVE policy
-- Solution: Add more explicit RESTRICTIVE policies for each operation type

-- Drop the existing generic ALL policy
DROP POLICY IF EXISTS "user_roles_require_auth_restrictive" ON public.user_roles;

-- Add explicit RESTRICTIVE policies for each operation type
-- This provides clearer defense-in-depth protection

CREATE POLICY "user_roles_select_requires_auth"
ON public.user_roles
AS RESTRICTIVE
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

CREATE POLICY "user_roles_insert_requires_auth"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "user_roles_update_requires_auth"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "user_roles_delete_requires_auth"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO public
USING (auth.uid() IS NOT NULL);

-- Result: Unauthenticated users are explicitly blocked from ALL operations
-- Authenticated users must still pass the existing PERMISSIVE policies:
-- - Regular users can only view their own roles
-- - Admins/owners can view all roles and manage them