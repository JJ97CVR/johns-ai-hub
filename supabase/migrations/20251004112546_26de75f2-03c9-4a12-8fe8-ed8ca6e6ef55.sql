-- Add DELETE policy for query_analytics to allow users to delete their own analytics data
-- This is required for GDPR compliance and data privacy

CREATE POLICY "Users can delete their own analytics"
ON public.query_analytics
FOR DELETE
USING (auth.uid() = user_id);

-- Optional: Add UPDATE policy to allow users to correct their data
CREATE POLICY "Users can update their own analytics"
ON public.query_analytics
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);