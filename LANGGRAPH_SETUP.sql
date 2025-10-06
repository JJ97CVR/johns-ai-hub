-- LangGraph Feature Flag Setup
-- Sprint 9: LangGraph Implementation
-- 
-- Run this SQL to create the feature flag for enabling LangGraph

-- Check if feature flag already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM feature_flags WHERE flag_key = 'use_langgraph'
  ) THEN
    -- Create feature flag (disabled by default for safety)
    INSERT INTO feature_flags (flag_key, enabled, description, config)
    VALUES (
      'use_langgraph',
      false,  -- Start disabled for testing
      'Use LangGraph instead of legacy orchestrator. Reduces code by 61% and adds built-in checkpointing, visualization, and better error handling.',
      jsonb_build_object(
        'version', '1.0',
        'rollout_percentage', 0,
        'created_sprint', 9,
        'benefits', jsonb_build_array(
          'Code reduction: -61% (1,505 → 580 lines)',
          'Built-in state management',
          'Automatic checkpointing',
          'LangSmith visualization',
          'Better error handling',
          'Resumable flows'
        )
      )
    );
    
    RAISE NOTICE 'Feature flag "use_langgraph" created (disabled by default)';
  ELSE
    RAISE NOTICE 'Feature flag "use_langgraph" already exists';
  END IF;
END $$;

-- To enable LangGraph (after testing):
-- UPDATE feature_flags SET enabled = true WHERE flag_key = 'use_langgraph';

-- To disable LangGraph (rollback if issues):
-- UPDATE feature_flags SET enabled = false WHERE flag_key = 'use_langgraph';

-- To check status:
-- SELECT flag_key, enabled, description FROM feature_flags WHERE flag_key = 'use_langgraph';
