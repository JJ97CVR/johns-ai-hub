-- Add assistant_message_id column to query_analytics for tracking specific responses
ALTER TABLE public.query_analytics 
ADD COLUMN assistant_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;