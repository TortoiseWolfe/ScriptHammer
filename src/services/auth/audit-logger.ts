/**
 * Audit Logger
 * Logs all authentication events to database for security auditing
 */

import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('auth:audit');

export enum AuthEventType {
  SIGN_UP = 'sign_up',
  SIGN_IN_SUCCESS = 'sign_in_success',
  SIGN_IN_FAILED = 'sign_in_failed',
  SIGN_OUT = 'sign_out',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_COMPLETE = 'password_reset_complete',
  EMAIL_VERIFICATION_SENT = 'email_verification_sent',
  EMAIL_VERIFICATION_COMPLETE = 'email_verification_complete',
  TOKEN_REFRESH = 'token_refresh',
  ACCOUNT_DELETE = 'account_delete',
}

interface AuditLogEntry {
  user_id: string | null;
  event_type: AuthEventType;
  event_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export class AuditLogger {
  private supabase = createClient();

  /**
   * Log sign-up event
   */
  async logSignUp(
    userId: string,
    email: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.SIGN_UP,
      event_data: { email },
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Log sign-in event
   */
  async logSignIn(
    userId: string | null,
    email: string,
    success: boolean,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: success
        ? AuthEventType.SIGN_IN_SUCCESS
        : AuthEventType.SIGN_IN_FAILED,
      event_data: { email },
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Log sign-out event
   */
  async logSignOut(userId: string, request?: Request): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.SIGN_OUT,
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Log password change
   */
  async logPasswordChange(userId: string, request?: Request): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.PASSWORD_CHANGE,
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Log password reset request
   */
  async logPasswordResetRequest(
    email: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: null,
      event_type: AuthEventType.PASSWORD_RESET_REQUEST,
      event_data: { email },
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Log password reset completion
   */
  async logPasswordResetComplete(
    userId: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.PASSWORD_RESET_COMPLETE,
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Log email verification sent
   */
  async logEmailVerificationSent(userId: string, email: string): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.EMAIL_VERIFICATION_SENT,
      event_data: { email },
    });
  }

  /**
   * Log email verification complete
   */
  async logEmailVerificationComplete(
    userId: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.EMAIL_VERIFICATION_COMPLETE,
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Log token refresh
   */
  async logTokenRefresh(userId: string): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.TOKEN_REFRESH,
    });
  }

  /**
   * Log account deletion
   */
  async logAccountDelete(userId: string, request?: Request): Promise<void> {
    await this.log({
      user_id: userId,
      event_type: AuthEventType.ACCOUNT_DELETE,
      ...this.extractRequestInfo(request),
    });
  }

  /**
   * Defensive filter — strip any field whose name suggests a credential or
   * secret before persisting event_data. The type Record<string, any> alone
   * doesn't prevent a caller passing { password } by accident, which would
   * land a plaintext credential in auth_audit_logs.
   */
  private stripCredentials(
    data: Record<string, unknown> | undefined
  ): Record<string, unknown> | undefined {
    if (!data) return data;
    const stripped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (/password|token|secret|key|credential/i.test(k)) continue;
      stripped[k] = v;
    }
    return stripped;
  }

  /**
   * Internal log method
   */
  private async log(entry: AuditLogEntry): Promise<void> {
    try {
      const safeEntry: AuditLogEntry = {
        ...entry,
        event_data: this.stripCredentials(entry.event_data),
      };
      const { error } = await this.supabase
        .from('auth_audit_logs')
        .insert(safeEntry);

      if (error) {
        logger.error('Audit log failed', { error: error.message });
      }
    } catch (error) {
      logger.error('Audit log exception', { error });
    }
  }

  /**
   * Extract IP address and user agent from request
   */
  private extractRequestInfo(request?: Request): Partial<AuditLogEntry> {
    if (!request) {
      return {};
    }

    return {
      ip_address:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      user_agent: request.headers.get('user-agent') || undefined,
    };
  }
}
