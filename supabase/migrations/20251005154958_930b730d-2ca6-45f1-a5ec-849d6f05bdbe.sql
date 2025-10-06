-- ============================================
-- Sprint 6: Feature Flags & Event-Driven Analytics
-- ============================================

-- Feature Flags Table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for feature flags (admins/owners only)
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can manage feature flags"
  ON public.feature_flags
  FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (true);

-- Analytics Queue Table (for event-driven analytics)
CREATE TABLE IF NOT EXISTS public.analytics_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  conversation_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

-- Index for unprocessed events
CREATE INDEX IF NOT EXISTS idx_analytics_queue_unprocessed 
  ON public.analytics_queue(created_at) 
  WHERE processed_at IS NULL;

-- RLS for analytics queue (service role only)
ALTER TABLE public.analytics_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages analytics queue"
  ON public.analytics_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger for feature flags updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default feature flags
INSERT INTO public.feature_flags (flag_key, enabled, description, config)
VALUES 
  ('web_search', true, 'Enable web search tool in chat', '{"max_results": 5}'::jsonb),
  ('image_generation', false, 'Enable image generation capabilities', '{}'::jsonb),
  ('advanced_rag', true, 'Enable advanced RAG with entity extraction', '{"similarity_threshold": 0.7}'::jsonb),
  ('rate_limit_strict', false, 'Enable strict rate limiting', '{"requests_per_minute": 10}'::jsonb)
ON CONFLICT (flag_key) DO NOTHING;