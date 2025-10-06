-- Sprint 4: Minor Improvements Migration

-- 1. SOFT DELETE: Add deleted_at columns
ALTER TABLE conversations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE uploaded_files ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create indexes for soft delete queries
CREATE INDEX idx_conversations_deleted ON conversations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_messages_deleted ON messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_uploaded_files_deleted ON uploaded_files(deleted_at) WHERE deleted_at IS NOT NULL;

-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete_conversation(conversation_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user owns the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = conversation_uuid 
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  -- Soft delete conversation and related data
  UPDATE conversations SET deleted_at = NOW() WHERE id = conversation_uuid;
  UPDATE messages SET deleted_at = NOW() WHERE conversation_id = conversation_uuid;
  UPDATE uploaded_files SET deleted_at = NOW() WHERE conversation_id = conversation_uuid;
END;
$$;

-- Update RLS policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.user_id = auth.uid()
    AND conversations.deleted_at IS NULL
  )
  AND messages.deleted_at IS NULL
);

DROP POLICY IF EXISTS "Users can view files in their conversations" ON uploaded_files;
CREATE POLICY "Users can view files in their conversations"
ON uploaded_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = uploaded_files.conversation_id 
    AND conversations.user_id = auth.uid()
    AND conversations.deleted_at IS NULL
  )
  AND uploaded_files.deleted_at IS NULL
);

-- 2. CHECKPOINTING: Create loop_checkpoints table
CREATE TABLE IF NOT EXISTS loop_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  iteration INTEGER NOT NULL DEFAULT 0,
  state JSONB NOT NULL DEFAULT '{}',
  partial_content TEXT,
  tools_used TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX idx_checkpoints_request ON loop_checkpoints(request_id);
CREATE INDEX idx_checkpoints_expires ON loop_checkpoints(expires_at);
CREATE INDEX idx_checkpoints_conversation ON loop_checkpoints(conversation_id);

-- RLS for checkpoints
ALTER TABLE loop_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkpoints"
ON loop_checkpoints FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages checkpoints"
ON loop_checkpoints FOR ALL
USING (auth.role() = 'service_role');

-- Cleanup function for expired checkpoints
CREATE OR REPLACE FUNCTION cleanup_expired_checkpoints()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM loop_checkpoints WHERE expires_at < NOW();
$$;

-- 3. EMBEDDING-BASED TOOL SELECTION: Create tool_embeddings table
CREATE TABLE IF NOT EXISTS tool_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL UNIQUE,
  pattern TEXT NOT NULL,
  embedding vector(1536),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tool_embeddings_name ON tool_embeddings(tool_name);
CREATE INDEX idx_tool_embeddings_vector ON tool_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- RLS for tool_embeddings
ALTER TABLE tool_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tool embeddings"
ON tool_embeddings FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Service role can read tool embeddings"
ON tool_embeddings FOR SELECT
USING (auth.role() = 'service_role');

-- 4. UNIFIED DATA RETENTION: Enhanced cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(
  table_name TEXT,
  rows_deleted BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  analytics_deleted BIGINT;
  logs_deleted BIGINT;
  audit_deleted BIGINT;
  rate_limits_deleted BIGINT;
  checkpoints_deleted BIGINT;
  soft_deleted_deleted BIGINT;
BEGIN
  -- Analytics (60 days)
  DELETE FROM query_analytics WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS analytics_deleted = ROW_COUNT;
  
  -- Structured logs (30 days)
  DELETE FROM structured_logs WHERE timestamp < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS logs_deleted = ROW_COUNT;
  
  -- Audit logs (90 days)
  DELETE FROM admin_audit_log WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS audit_deleted = ROW_COUNT;
  
  -- Rate limits (2 hours)
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '2 hours';
  DELETE FROM model_rate_limits WHERE window_start < NOW() - INTERVAL '2 hours';
  GET DIAGNOSTICS rate_limits_deleted = ROW_COUNT;
  
  -- Expired checkpoints
  DELETE FROM loop_checkpoints WHERE expires_at < NOW();
  GET DIAGNOSTICS checkpoints_deleted = ROW_COUNT;
  
  -- Permanently delete soft-deleted conversations after 30 days
  DELETE FROM conversations WHERE deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS soft_deleted_deleted = ROW_COUNT;
  
  -- Return summary
  RETURN QUERY VALUES 
    ('query_analytics', analytics_deleted),
    ('structured_logs', logs_deleted),
    ('admin_audit_log', audit_deleted),
    ('rate_limits', rate_limits_deleted),
    ('loop_checkpoints', checkpoints_deleted),
    ('soft_deleted_conversations', soft_deleted_deleted);
END;
$$;