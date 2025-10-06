-- Sprint 5: Security & Observability

-- 1. Admin Audit Log Table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_created 
ON admin_audit_log(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_action_created 
ON admin_audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target 
ON admin_audit_log(target_type, target_id);

-- RLS for audit log (only admins/owners can read)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins and owners can read audit log"
ON public.admin_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "System can insert audit log"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 2. Rate Limits per Model Table
CREATE TABLE IF NOT EXISTS public.model_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  model text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  request_count integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, model, window_start)
);

-- Index for rate limit checks
CREATE INDEX IF NOT EXISTS idx_model_rate_limits_user_model 
ON model_rate_limits(user_id, model, window_start DESC);

-- RLS for model rate limits
ALTER TABLE public.model_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to model rate limits"
ON public.model_rate_limits
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own model rate limits"
ON public.model_rate_limits
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Structured Logs Table
CREATE TABLE IF NOT EXISTS public.structured_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamp with time zone DEFAULT now() NOT NULL,
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  message text NOT NULL,
  context jsonb,
  user_id uuid,
  conversation_id uuid,
  function_name text,
  duration_ms integer,
  error_stack text,
  metadata jsonb
);

-- Indexes for log queries
CREATE INDEX IF NOT EXISTS idx_structured_logs_timestamp 
ON structured_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_structured_logs_level_timestamp 
ON structured_logs(level, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_structured_logs_function 
ON structured_logs(function_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_structured_logs_user 
ON structured_logs(user_id, timestamp DESC);

-- RLS for structured logs
ALTER TABLE public.structured_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins and owners can read logs"
ON public.structured_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "System can insert logs"
ON public.structured_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 4. Cleanup function for old logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM structured_logs WHERE timestamp < now() - interval '30 days';
  DELETE FROM admin_audit_log WHERE created_at < now() - interval '90 days';
  DELETE FROM model_rate_limits WHERE window_start < now() - interval '2 hours';
$$;

COMMENT ON TABLE admin_audit_log IS 'Audit trail for all admin actions';
COMMENT ON TABLE model_rate_limits IS 'Per-model rate limiting for API calls';
COMMENT ON TABLE structured_logs IS 'Structured JSON logs for monitoring and debugging';