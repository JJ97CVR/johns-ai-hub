-- ============================================================
-- FAS 5: AUTO-LEARNING CRON JOB
-- Runs learn-from-feedback edge function every night at 03:00
-- ============================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- 3. Schedule auto-learning job (runs every night at 03:00 Swedish time)
SELECT cron.schedule(
  'auto-learn-from-feedback',
  '0 3 * * *', -- 03:00 every night
  $$
  SELECT net.http_post(
    url:='https://vvgcvyulcrgdtuzdobgn.supabase.co/functions/v1/learn-from-feedback',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);