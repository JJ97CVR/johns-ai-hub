-- Fix code_executions INSERT policy to allow proper access
-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "System manages code executions" ON code_executions;

-- Create a proper policy that allows users to create code executions for their own messages
CREATE POLICY "Users can create code executions for their messages"
ON code_executions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = code_executions.message_id
      AND c.user_id = auth.uid()
  )
);