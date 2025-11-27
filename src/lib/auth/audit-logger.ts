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
  | 'sign_out'
  | 'sign_up'
  | 'password_change'
  | 'password_reset_request'
  | 'email_verification'
  | 'oauth_link'
  | 'oauth_unlink';

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
    // Get user agent from browser
    const userAgent =
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

    // Prepare log entry
    const logEntry = {
      user_id: entry.user_id || null,
      event_type: entry.event_type,
      event_data: (entry.event_data as Json) || null,
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || userAgent || null,
      success: entry.success !== undefined ? entry.success : true,
      error_message: entry.error_message || null,
    };

    // Insert audit log
    const { error } = await supabase.from('auth_audit_logs').insert(logEntry);

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
 * Get client IP address (best effort)
 * Note: This is approximate and can be spoofed. Server-side IP detection is more reliable.
 */
export async function getClientIP(): Promise<string | undefined> {
  try {
    // In a real production app, you'd use a geolocation API or extract from request headers
    // For now, return undefined and let the database/server handle it
    return undefined;
  } catch (error) {
    return undefined;
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
