-- Enable LangGraph feature flag for better timeout handling
UPDATE feature_flags 
SET enabled = true,
    config = jsonb_set(
      config,
      '{enabled_at}',
      to_jsonb(NOW()::text)
    )
WHERE flag_key = 'use_langgraph';