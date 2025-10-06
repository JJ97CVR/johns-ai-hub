-- FAS 1 P0: Rate Limiting + Conversation Promotions Tables (Fixed)

-- ============================================
-- Rate Limits Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ip_address TEXT,
  endpoint TEXT NOT NULL DEFAULT 'chat',
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON public.rate_limits(user_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON public.rate_limits(ip_address, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON public.rate_limits(window_start);

-- RLS Policies for rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own rate limit status
CREATE POLICY "Users can view own rate limits" ON public.rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- Conversation Promotions Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversation_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  promoted_to_kb BOOLEAN DEFAULT false,
  promotion_reason TEXT,
  importance_score REAL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for promotion tracking
CREATE INDEX IF NOT EXISTS idx_promotions_conversation ON public.conversation_promotions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_promotions_not_promoted ON public.conversation_promotions(promoted_to_kb, created_at);
CREATE INDEX IF NOT EXISTS idx_promotions_message ON public.conversation_promotions(message_id);

-- RLS Policies for conversation_promotions
ALTER TABLE public.conversation_promotions ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access promotions" ON public.conversation_promotions
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view promotions for their conversations
CREATE POLICY "Users view own promotions" ON public.conversation_promotions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_promotions.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- ============================================
-- Cleanup Function for Old Rate Limits
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE window_start < NOW() - INTERVAL '2 hours';
END;
$$;

-- ============================================
-- Enhanced Analytics Columns
-- ============================================
ALTER TABLE public.query_analytics 
ADD COLUMN IF NOT EXISTS entities_used JSONB,
ADD COLUMN IF NOT EXISTS rag_quality_score REAL;