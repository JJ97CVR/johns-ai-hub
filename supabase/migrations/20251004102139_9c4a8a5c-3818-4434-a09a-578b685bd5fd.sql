-- Make code_executions immutable for audit trail integrity
-- Once a code execution is recorded, it should never be modified

-- Ensure RLS is enabled
ALTER TABLE code_executions ENABLE ROW LEVEL SECURITY;

-- Remove any existing UPDATE policies
DROP POLICY IF EXISTS code_executions_update_all ON code_executions;
DROP POLICY IF EXISTS code_executions_update_owner ON code_executions;
DROP POLICY IF EXISTS code_executions_update_service_role ON code_executions;

-- Revoke direct UPDATE grants
REVOKE UPDATE ON code_executions FROM PUBLIC;
REVOKE UPDATE ON code_executions FROM authenticated;

-- Explicitly deny all UPDATE operations via RLS policy
-- This makes the immutability explicit and documented
CREATE POLICY "code_executions_immutable"
ON code_executions FOR UPDATE
USING (false)       -- Never matches any row
WITH CHECK (false); -- Never allows new values

-- Add trigger for extra protection (blocks even superuser/service role attempts)
CREATE OR REPLACE FUNCTION deny_code_execution_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Code execution records are immutable and cannot be modified. Create a new record instead.'
    USING HINT = 'This is an audit trail - historical execution data must not be altered',
          ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS prevent_code_execution_updates ON code_executions;
CREATE TRIGGER prevent_code_execution_updates
BEFORE UPDATE ON code_executions
FOR EACH ROW
EXECUTE FUNCTION deny_code_execution_updates();

-- Add comment for documentation
COMMENT ON TABLE code_executions IS 'Immutable audit trail of code executions. Records cannot be updated after creation - only SELECT, INSERT, and DELETE are allowed.';
COMMENT ON TRIGGER prevent_code_execution_updates ON code_executions IS 'Prevents any updates to execution records to maintain audit trail integrity';