-- Add citations and tools_used columns to messages table
-- BUG-2 FIX: Required for storing assistant message metadata

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tools_used TEXT[] DEFAULT NULL;

-- Add index for faster queries on messages with citations
CREATE INDEX IF NOT EXISTS idx_messages_citations ON public.messages USING GIN (citations) 
WHERE citations IS NOT NULL;

-- Add index for messages with tools
CREATE INDEX IF NOT EXISTS idx_messages_tools_used ON public.messages USING GIN (tools_used) 
WHERE tools_used IS NOT NULL;

COMMENT ON COLUMN public.messages.citations IS 'Array of citation objects used in assistant response';
COMMENT ON COLUMN public.messages.tools_used IS 'Array of tool names used during response generation';