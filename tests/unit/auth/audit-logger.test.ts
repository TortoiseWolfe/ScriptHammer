/**
 * Unit Tests: Audit Logger
 * These tests define the expected behavior - they will FAIL until implementation
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditLogger, AuthEventType } from '@/services/auth/audit-logger';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client with singleton instance
const mockInsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
}));
const mockSupabaseClient = {
  from: mockFrom,
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  it('should log sign-up event', async () => {
    await logger.logSignUp('user-123', 'user@example.com');

    expect(mockFrom).toHaveBeenCalledWith('auth_audit_logs');
  });

  it('should log successful sign-in', async () => {
    await logger.logSignIn('user-123', 'user@example.com', true);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        event_type: AuthEventType.SIGN_IN_SUCCESS,
      })
    );
  });

  it('should log failed sign-in with email only', async () => {
    await logger.logSignIn(null, 'user@example.com', false);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        event_type: AuthEventType.SIGN_IN_FAILED,
        event_data: expect.objectContaining({
          email: 'user@example.com',
        }),
      })
    );
  });

  it('should log sign-out event', async () => {
    await logger.logSignOut('user-123');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        event_type: AuthEventType.SIGN_OUT,
      })
    );
  });

  it('should log password change', async () => {
    await logger.logPasswordChange('user-123');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        event_type: AuthEventType.PASSWORD_CHANGE,
      })
    );
  });

  it('should include IP address and user agent if available', async () => {
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.1';
          if (name === 'user-agent') return 'Mozilla/5.0';
          return null;
        },
      },
    };

    await logger.logSignIn(
      'user-123',
      'user@example.com',
      true,
      mockRequest as any
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      })
    );
  });

  it('should handle logging errors gracefully', async () => {
    const mockError = new Error('Database error');
    mockFrom.mockReturnValue({
      insert: vi.fn(() =>
        Promise.resolve({ data: null, error: mockError })
      ) as any,
    });

    // Should not throw
    await expect(
      logger.logSignUp('user-123', 'user@example.com')
    ).resolves.not.toThrow();
  });
});
