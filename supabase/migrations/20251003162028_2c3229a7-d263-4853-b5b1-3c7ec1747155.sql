-- Phase 1 & 2: Critical Security Fixes

-- 1. Make chat-files bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat-files';

-- 2. Add RLS policies for storage.objects (chat-files)
CREATE POLICY "Users can read own conversation files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files' 
  AND EXISTS (
    SELECT 1 
    FROM uploaded_files uf
    JOIN conversations c ON c.id = uf.conversation_id
    WHERE uf.storage_path = storage.objects.name
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload files to own conversations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "Users can delete own conversation files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 
    FROM uploaded_files uf
    JOIN conversations c ON c.id = uf.conversation_id
    WHERE uf.storage_path = storage.objects.name
    AND c.user_id = auth.uid()
  )
);

-- 3. Add missing policies for messages table
CREATE POLICY "Users can update recent messages"
ON messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
  AND created_at > NOW() - INTERVAL '5 minutes'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own messages"
ON messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- 4. Add missing policies for uploaded_files table
CREATE POLICY "Users can update own files"
ON uploaded_files FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = uploaded_files.conversation_id
    AND conversations.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = uploaded_files.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own files"
ON uploaded_files FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = uploaded_files.conversation_id
    AND conversations.user_id = auth.uid()
  )
);