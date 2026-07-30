/**
 * Audit Logger
 * Logs authentication and security events to the audit trail
 * REQ-SEC-007: Audit logging for security events
 */

import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('lib:auth:audit-logger');

export type AuditEventType =
  | 'sign_in'
  | 'sign_in_success' // #241: successful sign-in (what admin_auth_stats reads)
  | 'sign_in_failed' // #241: failed sign-in (what the failed-attempt detector reads)
  | 'sign_out'
  | 'sign_up'
  | 'password_change'
  | 'password_reset_request'
  | 'email_verification'
  | 'oauth_link'
  | 'oauth_unlink'
  | 'payment_retry';

export interface AuditLogEntry {
  user_id?: string;
  event_type: AuditEventType;
  event_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  success?: boolean;
  error_message?: string;
}

/**
 * Log an authentication or security event to the audit trail
 *
 * @param entry - Audit log entry details
 *
 * @example
 * // Log successful sign-in
 * await logAuthEvent({
 *   user_id: user.id,
 *   event_type: 'sign_in',
 *   event_data: { provider: 'email' }
 * });
 *
 * @example
 * // Log failed password change
 * await logAuthEvent({
 *   user_id: user.id,
 *   event_type: 'password_change',
 *   success: false,
 *   error_message: 'Current password incorrect'
 * });
 */
export async function logAuthEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // Get user agent from browser.
    //
    // `typeof window`, not `typeof navigator`: Node 18+ ships a global
    // `navigator`, and its userAgent is the literal string 'Node.js/22'. With
    // the old guard, any server-side call recorded THAT as the user's browser in
    // the audit trail — a plausible-looking wrong value, which is worse than the
    // undefined it was meant to fall back to (#466).
    const userAgent =
      typeof window !== 'undefined' ? navigator.userAgent : undefined;

    // #241: write via the log_auth_event RPC, NOT a direct table insert. The
    // auth_audit_logs INSERT policy only permits service_role, so the old
    // client-side `.from('auth_audit_logs').insert()` was silently RLS-rejected
    // for every real sign-in and failed login. The SECURITY DEFINER RPC bypasses
    // RLS while enforcing that a caller can only log for itself or anonymously.
    // ip_address is intentionally omitted — clients can't observe their own
    // public IP reliably, and a spoofable client-supplied IP is worse than none;
    // server-side paths that need it can populate it out of band.
    const { error } = await supabase.rpc('log_auth_event', {
      p_event_type: entry.event_type,
      // Omit optionals (leave undefined) rather than pass null — the RPC's
      // DEFAULT NULL fills them in. A NULL p_user_id is the correct anonymous
      // case for a failed login (no session yet).
      p_user_id: entry.user_id || undefined,
      p_event_data: (entry.event_data as Json) ?? undefined,
      p_success: entry.success !== undefined ? entry.success : true,
      p_error_message: entry.error_message || undefined,
      p_user_agent: entry.user_agent || userAgent || undefined,
    });

    if (error) {
      logger.error('Failed to log audit event', {
        error,
        eventType: entry.event_type,
      });
      // Non-critical failure - don't throw
    }
  } catch (error) {
    logger.error('Error logging audit event', {
      error,
      eventType: entry.event_type,
    });
    // Non-critical failure - don't throw
  }
}

/**
 * Get user audit logs (for displaying to the user)
 *
 * @param userId - User ID to fetch logs for
 * @param limit - Maximum number of logs to return
 * @returns Array of audit log entries
 */
export async function getUserAuditLogs(
  userId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('auth_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch audit logs', { error, userId });
      return [];
    }

    return (data || []) as AuditLogEntry[];
  } catch (error) {
    logger.error('Error fetching audit logs', { error, userId });
    return [];
  }
}
