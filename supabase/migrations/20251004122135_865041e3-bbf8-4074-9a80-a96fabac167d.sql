-- Fix 1: Update model check constraint to allow all supported models
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_model_check;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_model_check CHECK (
  model IN (
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'openai/gpt-5-nano',
    'google/gemini-2.5-flash',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash-lite',
    'anthropic/claude-sonnet-4-20250514',
    'claude-sonnet-4-20250514'
  )
);

-- Fix 2: Ensure pgvector extension and operators are properly set up
-- Drop and recreate extension to fix operator issues
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Recreate match functions with proper schema references
DROP FUNCTION IF EXISTS public.match_knowledge(vector, double precision, integer);
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector,
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  category text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
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

DROP FUNCTION IF EXISTS public.match_patterns(vector, double precision, integer);
CREATE OR REPLACE FUNCTION public.match_patterns(
  query_embedding vector,
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE(
  id uuid,
  question_pattern text,
  answer_template text,
  usage_count integer,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
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