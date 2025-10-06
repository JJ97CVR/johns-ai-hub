-- Fix admin_audit_log public exposure: Add explicit authentication requirements
-- Issue: Policies check admin/owner roles without explicit auth verification first
-- Solution: Add RESTRICTIVE policies requiring authentication for defense-in-depth

-- Add explicit RESTRICTIVE policies for each operation type
-- These will be ANDed with existing PERMISSIVE policies

CREATE POLICY "admin_audit_log_select_requires_auth"
ON public.admin_audit_log
AS RESTRICTIVE
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_audit_log_insert_requires_auth"
ON public.admin_audit_log
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "admin_audit_log_update_requires_auth"
ON public.admin_audit_log
AS RESTRICTIVE
FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "admin_audit_log_delete_requires_auth"
ON public.admin_audit_log
AS RESTRICTIVE
FOR DELETE
TO public
USING (auth.uid() IS NOT NULL);

-- Result: Defense-in-depth protection
-- 1. User must be authenticated (RESTRICTIVE policies - ANDed)
-- 2. User must have admin/owner role (existing PERMISSIVE policies)
-- 3. Audit logs remain immutable (existing denial policies for UPDATE/DELETE)