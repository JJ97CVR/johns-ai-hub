-- Fix query_analytics FK to allow conversation deletion with CASCADE
ALTER TABLE query_analytics
  DROP CONSTRAINT IF EXISTS query_analytics_conversation_id_fkey;

ALTER TABLE query_analytics
  ADD CONSTRAINT query_analytics_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES conversations(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;