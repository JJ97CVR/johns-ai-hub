-- Fix model constraint to include Claude Sonnet 4.5
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
    'anthropic/claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514'
  )
);