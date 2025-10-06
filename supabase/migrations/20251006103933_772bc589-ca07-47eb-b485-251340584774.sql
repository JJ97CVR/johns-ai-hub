-- Add restrictive policy requiring authentication for all operations on user_roles
-- This is a defense-in-depth measure to explicitly block unauthenticated access
-- RESTRICTIVE policies are ANDed with permissive policies, creating a mandatory auth check

CREATE POLICY "user_roles_require_auth_restrictive" 
ON public.user_roles 
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);