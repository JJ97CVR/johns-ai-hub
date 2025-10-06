-- Fix FK constraint to allow conversation deletion
ALTER TABLE query_analytics
  DROP CONSTRAINT IF EXISTS query_analytics_conversation_id_fkey;

ALTER TABLE query_analytics
  ADD CONSTRAINT query_analytics_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES conversations(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;