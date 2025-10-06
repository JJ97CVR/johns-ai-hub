-- Add RESTRICTIVE policies to prevent tampering with audit logs
-- Audit logs must be immutable once created

-- Deny all UPDATE operations on audit logs
CREATE POLICY "Audit logs are immutable - no updates allowed"
ON public.admin_audit_log
AS RESTRICTIVE
FOR UPDATE
USING (false);

-- Deny all DELETE operations on audit logs  
CREATE POLICY "Audit logs are immutable - no deletes allowed"
ON public.admin_audit_log
AS RESTRICTIVE
FOR DELETE
USING (false);

-- Add comment explaining the security model
COMMENT ON TABLE public.admin_audit_log IS 'Immutable audit trail of administrative actions. Records can only be inserted by service role and never modified or deleted to ensure integrity of audit history.';