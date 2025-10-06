-- Sprint 2 Fix 5: Förbättrade RLS Policies för messages

-- Drop existing policies for clean update
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update recent messages" ON messages;

-- CREATE policy with explicit WITH CHECK
CREATE POLICY "Users can create messages in their conversations"
ON messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
);

-- UPDATE policy with both USING and WITH CHECK
CREATE POLICY "Users can update recent messages"
ON messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
  AND created_at > (now() - interval '5 minutes')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
);

-- Add index for performance on frequent RLS checks
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

-- Add documentation
COMMENT ON POLICY "Users can create messages in their conversations" ON messages IS 
'Allows users to create messages only in their own conversations. WITH CHECK ensures the conversation_id belongs to the authenticated user.';

COMMENT ON POLICY "Users can update recent messages" ON messages IS 
'Allows users to update only their own messages within 5 minutes of creation. Prevents editing old message history.';