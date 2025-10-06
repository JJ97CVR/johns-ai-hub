-- Phase 1: Fix Critical Data Exposure
-- Remove public access policies and add authenticated-only policies

-- 1. Fix knowledge_base table
DROP POLICY IF EXISTS "Anyone can read knowledge" ON public.knowledge_base;

CREATE POLICY "Authenticated users can read knowledge"
ON public.knowledge_base
FOR SELECT
TO authenticated
USING (true);

-- 2. Fix organization_facts table
DROP POLICY IF EXISTS "Anyone can read org facts" ON public.organization_facts;

CREATE POLICY "Authenticated users can read org facts"
ON public.organization_facts
FOR SELECT
TO authenticated
USING (true);

-- 3. Fix learned_patterns table
DROP POLICY IF EXISTS "Anyone can read patterns" ON public.learned_patterns;

CREATE POLICY "Authenticated users can read patterns"
ON public.learned_patterns
FOR SELECT
TO authenticated
USING (true);

-- 4. Fix response_cache table
DROP POLICY IF EXISTS "Anyone can read cache" ON public.response_cache;

CREATE POLICY "Authenticated users can read cache"
ON public.response_cache
FOR SELECT
TO authenticated
USING (true);

-- Phase 2: Fix Database Functions - Add search_path
CREATE OR REPLACE FUNCTION public.match_knowledge(query_embedding vector, match_threshold double precision, match_count integer)
RETURNS TABLE(id uuid, title text, content text, category text, similarity double precision)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base.id,
    knowledge_base.title,
    knowledge_base.content,
    knowledge_base.category,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM knowledge_base
  WHERE 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_patterns(query_embedding vector, match_threshold double precision, match_count integer)
RETURNS TABLE(id uuid, question_pattern text, answer_template text, usage_count integer, similarity double precision)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    learned_patterns.id,
    learned_patterns.question_pattern,
    learned_patterns.answer_template,
    learned_patterns.usage_count,
    1 - (learned_patterns.embedding <=> query_embedding) as similarity
  FROM learned_patterns
  WHERE 1 - (learned_patterns.embedding <=> query_embedding) > match_threshold
  ORDER BY learned_patterns.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;