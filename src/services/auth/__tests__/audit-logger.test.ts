/**
 * Unit Test: AuditLogger
 *
 * Tests the authentication audit logger with a mocked Supabase client and a
 * mocked logger. No network dependency - fast, reliable unit tests.
 *
 * Key behaviors verified:
 *  - each public logger method inserts into 'auth_audit_logs' with the correct
 *    event_type (and user_id / event_data shape)
 *  - stripCredentials() removes any event_data field whose name matches
 *    /password|token|secret|key|credential/i before persisting
 *  - extractRequestInfo() pulls ip_address + user_agent from a Request-like
 *    object ({ headers: { get } })
 *  - log() SILENTLY swallows insert errors / exceptions (never throws) and
 *    routes them to logger.error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
// Type-only import for annotations (the runtime value comes from the dynamic
// import below, which TS sees as a value, not a type).
import type { AuthEventType as AuthEventTypeT } from '../audit-logger';

// Valid test UUIDs
const USER_ID = '00000000-0000-0000-0000-000000000001';

// Mock the logger - vi.hoisted so the spy exists before the service module is
// imported (the service calls createLogger('auth:audit') at module load).
const mockLoggerFns = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => mockLoggerFns),
}));

// Mock Supabase client. `insert` resolves to { error } directly (no chained
// terminal in the service), so it returns a thenable-style result.
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

const mockSupabase = {
  from: mockFrom,
} as unknown as SupabaseClient;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Import after mocks are set up
const { AuditLogger, AuthEventType } = await import('../audit-logger');

/** Build a Request-like object backed by a vi.fn() header getter. */
const makeRequest = (headers: Record<string, string>) => {
  const get = vi.fn((name: string) => headers[name.toLowerCase()] ?? null);
  return { headers: { get } } as unknown as Request;
};

/** Return the entry object passed to .insert() during the last log() call. */
const lastInsertPayload = () => mockInsert.mock.calls.at(-1)?.[0];

describe('AuditLogger', () => {
  let auditLogger: InstanceType<typeof AuditLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: insert succeeds.
    mockInsert.mockResolvedValue({ error: null });
    auditLogger = new AuditLogger();
  });

  describe('logSignUp', () => {
    it('inserts a sign_up event into auth_audit_logs', async () => {
      await auditLogger.logSignUp(USER_ID, 'user@example.com');

      expect(mockFrom).toHaveBeenCalledWith('auth_audit_logs');
      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.SIGN_UP,
        event_data: { email: 'user@example.com' },
      });
    });

    it('attaches request info when a request is provided', async () => {
      const request = makeRequest({
        'x-forwarded-for': '203.0.113.5',
        'user-agent': 'TestAgent/1.0',
      });

      await auditLogger.logSignUp(USER_ID, 'user@example.com', request);

      expect(lastInsertPayload()).toMatchObject({
        ip_address: '203.0.113.5',
        user_agent: 'TestAgent/1.0',
      });
    });
  });

  describe('logSignIn', () => {
    it('records sign_in_success when success is true', async () => {
      await auditLogger.logSignIn(USER_ID, 'user@example.com', true);

      expect(mockFrom).toHaveBeenCalledWith('auth_audit_logs');
      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.SIGN_IN_SUCCESS,
        event_data: { email: 'user@example.com' },
      });
    });

    it('records sign_in_failed with a null user_id when success is false', async () => {
      await auditLogger.logSignIn(null, 'user@example.com', false);

      expect(lastInsertPayload()).toMatchObject({
        user_id: null,
        event_type: AuthEventType.SIGN_IN_FAILED,
        event_data: { email: 'user@example.com' },
      });
    });
  });

  describe('logSignOut', () => {
    it('inserts a sign_out event', async () => {
      await auditLogger.logSignOut(USER_ID);

      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.SIGN_OUT,
      });
    });

    it('omits request info when no request is given', async () => {
      await auditLogger.logSignOut(USER_ID);

      const payload = lastInsertPayload();
      expect(payload).not.toHaveProperty('ip_address');
      expect(payload).not.toHaveProperty('user_agent');
    });
  });

  describe('logPasswordChange', () => {
    it('inserts a password_change event', async () => {
      await auditLogger.logPasswordChange(USER_ID);

      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.PASSWORD_CHANGE,
      });
    });
  });

  describe('logPasswordResetRequest', () => {
    it('inserts a password_reset_request event with a null user_id', async () => {
      await auditLogger.logPasswordResetRequest('user@example.com');

      expect(lastInsertPayload()).toMatchObject({
        user_id: null,
        event_type: AuthEventType.PASSWORD_RESET_REQUEST,
        event_data: { email: 'user@example.com' },
      });
    });

    it('captures ip + user agent from the request', async () => {
      const request = makeRequest({
        'x-real-ip': '198.51.100.7',
        'user-agent': 'ResetAgent/2.0',
      });

      await auditLogger.logPasswordResetRequest('user@example.com', request);

      expect(lastInsertPayload()).toMatchObject({
        ip_address: '198.51.100.7',
        user_agent: 'ResetAgent/2.0',
      });
    });
  });

  describe('logPasswordResetComplete', () => {
    it('inserts a password_reset_complete event', async () => {
      await auditLogger.logPasswordResetComplete(USER_ID);

      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.PASSWORD_RESET_COMPLETE,
      });
    });
  });

  describe('logEmailVerificationSent', () => {
    it('inserts an email_verification_sent event with the email', async () => {
      await auditLogger.logEmailVerificationSent(USER_ID, 'user@example.com');

      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.EMAIL_VERIFICATION_SENT,
        event_data: { email: 'user@example.com' },
      });
    });
  });

  describe('logEmailVerificationComplete', () => {
    it('inserts an email_verification_complete event', async () => {
      await auditLogger.logEmailVerificationComplete(USER_ID);

      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.EMAIL_VERIFICATION_COMPLETE,
      });
    });
  });

  describe('logTokenRefresh', () => {
    it('inserts a token_refresh event', async () => {
      await auditLogger.logTokenRefresh(USER_ID);

      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.TOKEN_REFRESH,
      });
    });
  });

  describe('logAccountDelete', () => {
    it('inserts an account_delete event', async () => {
      await auditLogger.logAccountDelete(USER_ID);

      expect(lastInsertPayload()).toMatchObject({
        user_id: USER_ID,
        event_type: AuthEventType.ACCOUNT_DELETE,
      });
    });
  });

  describe('stripCredentials', () => {
    it('strips password/token/secret/key/credential fields from event_data', async () => {
      // Reach into the private log() via a thin subclass to feed arbitrary
      // event_data, exercising stripCredentials() on the real insert payload.
      class TestableAuditLogger extends AuditLogger {
        async logRaw(entry: {
          user_id: string | null;
          event_type: AuthEventTypeT;
          event_data?: Record<string, unknown>;
        }) {
          // @ts-expect-error - exercising the private log() method under test
          await this.log(entry);
        }
      }

      const testable = new TestableAuditLogger();
      await testable.logRaw({
        user_id: USER_ID,
        event_type: AuthEventType.SIGN_IN_SUCCESS,
        event_data: {
          email: 'user@example.com',
          password: 'hunter2',
          access_token: 'abc.def',
          apiKey: 'sk-123',
          mySecret: 'shh',
          userCredential: 'nope',
          safeField: 'kept',
        },
      });

      const payload = lastInsertPayload();
      expect(payload.event_data).toEqual({
        email: 'user@example.com',
        safeField: 'kept',
      });
      expect(payload.event_data).not.toHaveProperty('password');
      expect(payload.event_data).not.toHaveProperty('access_token');
      expect(payload.event_data).not.toHaveProperty('apiKey');
      expect(payload.event_data).not.toHaveProperty('mySecret');
      expect(payload.event_data).not.toHaveProperty('userCredential');
    });

    it('leaves undefined event_data as undefined', async () => {
      await auditLogger.logSignOut(USER_ID);
      expect(lastInsertPayload().event_data).toBeUndefined();
    });
  });

  describe('extractRequestInfo', () => {
    it('prefers x-forwarded-for over x-real-ip for ip_address', async () => {
      const request = makeRequest({
        'x-forwarded-for': '10.0.0.1',
        'x-real-ip': '10.0.0.2',
        'user-agent': 'UA/9',
      });

      await auditLogger.logSignOut(USER_ID, request);

      expect(lastInsertPayload()).toMatchObject({
        ip_address: '10.0.0.1',
        user_agent: 'UA/9',
      });
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
      const request = makeRequest({
        'x-real-ip': '10.0.0.2',
        'user-agent': 'UA/9',
      });

      await auditLogger.logSignOut(USER_ID, request);

      expect(lastInsertPayload()).toMatchObject({ ip_address: '10.0.0.2' });
    });

    it('sets ip_address to undefined when no ip headers are present', async () => {
      const request = makeRequest({ 'user-agent': 'UA/9' });

      await auditLogger.logSignOut(USER_ID, request);

      const payload = lastInsertPayload();
      expect(payload.ip_address).toBeUndefined();
      expect(payload.user_agent).toBe('UA/9');
    });
  });

  describe('error handling (log never throws)', () => {
    it('swallows a Supabase insert error and routes it to logger.error', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'insert boom' } });

      await expect(auditLogger.logSignOut(USER_ID)).resolves.toBeUndefined();

      expect(mockLoggerFns.error).toHaveBeenCalledWith('Audit log failed', {
        error: 'insert boom',
      });
    });

    it('swallows a thrown insert exception and routes it to logger.error', async () => {
      const boom = new Error('network down');
      mockInsert.mockRejectedValue(boom);

      await expect(auditLogger.logSignOut(USER_ID)).resolves.toBeUndefined();

      expect(mockLoggerFns.error).toHaveBeenCalledWith('Audit log exception', {
        error: boom,
      });
    });
  });
});
