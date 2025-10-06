-- Fix privacy issue: Remove admin policy that exposes all user queries
-- Users should only see their own analytics
-- Admins will get aggregated stats through a secure function instead

DROP POLICY IF EXISTS "Only admins can access knowledge stats" ON public.query_analytics;

-- Create a secure function for admins to get aggregated analytics
-- This returns summary data without exposing individual user queries
CREATE OR REPLACE FUNCTION public.get_aggregated_analytics(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE(
  total_queries BIGINT,
  unique_users BIGINT,
  avg_processing_time NUMERIC,
  cache_hit_rate NUMERIC,
  top_query_types JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins/owners can call this function
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'Access denied: Admin or owner role required';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_queries,
    COUNT(DISTINCT user_id)::BIGINT as unique_users,
    ROUND(AVG(processing_time_ms)::NUMERIC, 2) as avg_processing_time,
    ROUND((COUNT(*) FILTER (WHERE cache_hit = true)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 2) as cache_hit_rate,
    jsonb_agg(
      jsonb_build_object(
        'type', query_type,
        'count', type_count
      )
      ORDER BY type_count DESC
    ) FILTER (WHERE query_type IS NOT NULL) as top_query_types
  FROM (
    SELECT
      user_id,
      processing_time_ms,
      cache_hit,
      query_type,
      COUNT(*) OVER (PARTITION BY query_type) as type_count
    FROM public.query_analytics
    WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  ) subquery;
END;
$$;

-- Grant execute permission to authenticated users
-- (the function itself checks for admin/owner role)
GRANT EXECUTE ON FUNCTION public.get_aggregated_analytics TO authenticated;