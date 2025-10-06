-- ============================================================
-- FAS 5: FEEDBACK SYSTEM - User Feedback & Quality Signals
-- Expected Impact: 20% feedback rate, 80% positive, auto-learning
-- ============================================================

-- 1. Message Feedback table (thumbs up/down)
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helpful BOOLEAN NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- 2. Quality Signals table (interaction tracking)
CREATE TABLE IF NOT EXISTS public.quality_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('citation_clicked', 'regenerated', 'copied', 'shared', 'code_executed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_signals ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for message_feedback
CREATE POLICY "Users can insert their own feedback"
ON public.message_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own feedback"
ON public.message_feedback
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own feedback"
ON public.message_feedback
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. RLS Policies for quality_signals
CREATE POLICY "Users can insert quality signals for their messages"
ON public.quality_signals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view quality signals for their messages"
ON public.quality_signals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_id AND c.user_id = auth.uid()
  )
);

-- 6. Service role can access everything for auto-learning
CREATE POLICY "Service role full access to feedback"
ON public.message_feedback
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access to signals"
ON public.quality_signals
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON public.message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON public.message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_helpful ON public.message_feedback(helpful);
CREATE INDEX IF NOT EXISTS idx_quality_signals_message_id ON public.quality_signals(message_id);
CREATE INDEX IF NOT EXISTS idx_quality_signals_type ON public.quality_signals(signal_type);