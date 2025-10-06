-- Sprint 2 Fix 6: PII-reducering i query_analytics

-- Add query_hash column for hashed queries
ALTER TABLE query_analytics ADD COLUMN IF NOT EXISTS query_hash TEXT;

-- Create function for query hashing (SHA-256)
CREATE OR REPLACE FUNCTION hash_query(query_text TEXT) 
RETURNS TEXT AS $$
  SELECT encode(digest(query_text, 'sha256'), 'hex');
$$ LANGUAGE SQL IMMUTABLE;

-- Create index on query_hash for faster lookups
CREATE INDEX IF NOT EXISTS idx_query_analytics_hash ON query_analytics(query_hash);

-- Add retention cleanup function (60 days)
CREATE OR REPLACE FUNCTION cleanup_old_analytics() 
RETURNS void AS $$
  DELETE FROM query_analytics WHERE created_at < now() - interval '60 days';
$$ LANGUAGE SQL SECURITY DEFINER;

-- Add columns for better observability
ALTER TABLE query_analytics ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE query_analytics ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE query_analytics ADD COLUMN IF NOT EXISTS tokens_in INTEGER;
ALTER TABLE query_analytics ADD COLUMN IF NOT EXISTS tokens_out INTEGER;
ALTER TABLE query_analytics ADD COLUMN IF NOT EXISTS tools_called TEXT[];

-- Add documentation
COMMENT ON COLUMN query_analytics.query_hash IS 'SHA-256 hash of query for analytics without storing sensitive content';
COMMENT ON COLUMN query_analytics.query IS 'Truncated query text (max 200 chars) - full content not stored for privacy';
COMMENT ON FUNCTION cleanup_old_analytics() IS 'Remove analytics data older than 60 days for GDPR compliance';

-- Update existing rows with hashes
UPDATE query_analytics 
SET query_hash = hash_query(query) 
WHERE query_hash IS NULL AND query IS NOT NULL;