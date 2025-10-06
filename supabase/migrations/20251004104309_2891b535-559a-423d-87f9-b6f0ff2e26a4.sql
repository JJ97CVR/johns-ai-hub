-- Enable pgcrypto extension for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update hash_query function with search_path and pgcrypto
CREATE OR REPLACE FUNCTION hash_query(query_text TEXT) 
RETURNS TEXT 
LANGUAGE SQL 
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(digest(query_text, 'sha256'), 'hex');
$$;

-- Update cleanup_old_analytics function with search_path
CREATE OR REPLACE FUNCTION cleanup_old_analytics() 
RETURNS void 
LANGUAGE SQL 
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM query_analytics WHERE created_at < now() - interval '60 days';
$$;