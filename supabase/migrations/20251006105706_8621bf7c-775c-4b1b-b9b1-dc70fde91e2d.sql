-- Fix conversations public exposure: Add explicit authentication requirements
-- Issue: Scanner detects conversations as publicly accessible without explicit auth checks
-- Solution: Add RESTRICTIVE policies requiring authentication for defense-in-depth

-- Add explicit RESTRICTIVE policies for each operation type
-- These will be ANDed with existing PERMISSIVE policies

CREATE POLICY "conversations_select_requires_auth"
ON public.conversations
AS RESTRICTIVE
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

CREATE POLICY "conversations_insert_requires_auth"
ON public.conversations
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "conversations_update_requires_auth"
ON public.conversations
AS RESTRICTIVE
FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "conversations_delete_requires_auth"
ON public.conversations
AS RESTRICTIVE
FOR DELETE
TO public
USING (auth.uid() IS NOT NULL);

-- Result: Defense-in-depth protection
-- Unauthenticated users are explicitly blocked from ALL operations
-- Authenticated users must still pass the existing PERMISSIVE policies:
-- - Users can only see/modify/delete their own conversations (auth.uid() = user_id)
-- - Deleted conversations are hidden from SELECT queries