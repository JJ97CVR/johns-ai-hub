-- ============================================
-- SECURITY FIX: Remove Public Access to Feature Flags
-- Sprint 6: Security Hardening
-- ============================================

-- Drop the insecure public read policy
DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.feature_flags;

-- Feature flags should ONLY be readable by:
-- 1. Service role (edge functions) - bypasses RLS automatically
-- 2. Admins/owners for management UI (if exists)

-- Admin/owner read policy already exists:
-- "Admins and owners can manage feature flags" (FOR ALL)
-- This covers SELECT, INSERT, UPDATE, DELETE for admins/owners

-- No additional policy needed - service role will continue to work
-- and only admins/owners can view flags in any admin UI

-- Security verification:
-- ✅ Service role (edge functions) - bypasses RLS
-- ✅ Admins/owners - has full access via existing policy
-- ❌ Regular users - no access (security improvement)
-- ❌ Public/unauthenticated - no access (security improvement)