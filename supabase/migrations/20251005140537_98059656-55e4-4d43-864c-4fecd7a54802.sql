-- SPRINT 2: Remove unused conversation_insights table and related indexes
-- This feature was not being used and only added database overhead

DROP TABLE IF EXISTS public.conversation_insights CASCADE;