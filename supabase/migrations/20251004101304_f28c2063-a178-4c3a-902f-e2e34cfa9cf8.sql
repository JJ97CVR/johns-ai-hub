-- Add DELETE policy for code_executions to allow users to clean up their execution history
-- UPDATE is intentionally excluded to prevent tampering with execution results

-- Allow users to delete code executions from their own conversations
CREATE POLICY "code_executions_delete_owner"
ON code_executions FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = code_executions.message_id
      AND c.user_id = auth.uid()
  )
);

-- Optionally, allow service role to delete (for cleanup jobs)
CREATE POLICY "code_executions_delete_service_role"
ON code_executions FOR DELETE
USING (auth.role() = 'service_role');

-- Note: UPDATE policy is intentionally NOT added to prevent tampering with execution results
-- This maintains audit trail integrity while allowing privacy-respecting deletion