-- Fix 2: Remove overly broad storage policy that exposes files
-- This policy allowed any authenticated user to view all files
DROP POLICY IF EXISTS "Users can view files" ON storage.objects;

-- Keep only the secure policies that verify ownership via conversations
-- (These should already exist from previous migrations)