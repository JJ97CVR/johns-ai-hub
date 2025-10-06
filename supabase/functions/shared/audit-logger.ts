/**
 * Admin Audit Logger
 * Sprint 5: Security
 * 
 * Logs all admin actions for compliance and security monitoring.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuditLogEntry {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an admin action to the audit log
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const { error } = await supabase.from('admin_audit_log').insert({
      admin_user_id: entry.adminUserId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      changes: entry.changes,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });

    if (error) {
      console.error('Failed to log admin action:', error);
    }
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

/**
 * Get recent admin actions (for audit review)
 */
export async function getRecentAuditLogs(
  supabase: SupabaseClient,
  limit: number = 100
): Promise<any[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }

  return data || [];
}

/**
 * Get audit logs for a specific admin user
 */
export async function getAdminAuditHistory(
  supabase: SupabaseClient,
  adminUserId: string,
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .eq('admin_user_id', adminUserId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch admin audit history:', error);
    return [];
  }

  return data || [];
}
