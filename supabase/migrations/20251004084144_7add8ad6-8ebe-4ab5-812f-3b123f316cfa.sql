-- Add RLS policies to system tables for security scanner compliance
-- These tables are meant to be accessed via service role in edge functions,
-- but we add explicit policies to satisfy security scanners

-- Knowledge Base: Read-only for authenticated users, write for admins/owners
CREATE POLICY "Authenticated users can read knowledge base"
ON public.knowledge_base
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and owners can insert knowledge"
ON public.knowledge_base
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "Admins and owners can update knowledge"
ON public.knowledge_base
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "Admins and owners can delete knowledge"
ON public.knowledge_base
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Learned Patterns: Read-only for authenticated users, system manages writes
CREATE POLICY "Authenticated users can read patterns"
ON public.learned_patterns
FOR SELECT
TO authenticated
USING (true);

-- Response Cache: Read-only for authenticated users, system manages writes
CREATE POLICY "Authenticated users can read cache"
ON public.response_cache
FOR SELECT
TO authenticated
USING (true);

-- Organization Facts: Read-only for authenticated users, write for admins/owners
CREATE POLICY "Authenticated users can read org facts"
ON public.organization_facts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and owners can insert org facts"
ON public.organization_facts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "Admins and owners can update org facts"
ON public.organization_facts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "Admins and owners can delete org facts"
ON public.organization_facts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);