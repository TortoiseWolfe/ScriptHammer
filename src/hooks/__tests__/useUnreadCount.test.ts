/**
 * Unit Tests for useUnreadCount
 *
 * Ported from SpokeToWork fork — verifies Realtime subscription
 * replaces 30s polling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock user
const mockUser = { id: 'user-123' };

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    session: { user: mockUser },
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  })),
}));

// Mock channel
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

// Mock messaging client
const mockMessagingFrom = vi.fn();
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: vi.fn(() => ({
    from: mockMessagingFrom,
  })),
}));

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

// Import after mocks
import { useUnreadCount } from '../useUnreadCount';

describe('useUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup messaging client mock chain
    mockMessagingFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn(() => ({
            or: vi.fn().mockResolvedValue({
              data: [{ id: 'conv-1' }, { id: 'conv-2' }],
            }),
          })),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              neq: vi.fn(() => ({
                is: vi.fn().mockResolvedValue({ count: 5 }),
              })),
            })),
          })),
        };
      }
      return {};
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with 0 unread count', () => {
      const { result } = renderHook(() => useUnreadCount());

      expect(result.current).toBe(0);
    });
  });

  describe('when user is authenticated', () => {
    it('should fetch unread count', async () => {
      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(5);
      });
    });

    it('should setup realtime subscription', async () => {
      const { supabase } = await import('@/lib/supabase/client');

      renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith(
          `unread-messages-${mockUser.id}`
        );
      });
    });

    it('should subscribe to postgres_changes on messages', async () => {
      renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          expect.objectContaining({
            event: '*',
            schema: 'public',
            table: 'messages',
          }),
          expect.any(Function)
        );
      });
    });
  });

  describe('when user is not authenticated', () => {
    it('should return 0 when no user', async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
      } as never);

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(0);
      });
    });
  });

  describe('when no conversations', () => {
    it('should return 0 when no conversations', async () => {
      mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              or: vi.fn().mockResolvedValue({ data: [] }),
            })),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(0);
      });
    });
  });

  describe('error handling', () => {
    it('should return 0 on error', async () => {
      mockMessagingFrom.mockImplementation(() => {
        throw new Error('Database error');
      });

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(0);
      });
    });
  });

  describe('cleanup', () => {
    it('should handle unmount without throwing', () => {
      const { unmount } = renderHook(() => useUnreadCount());

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('return value', () => {
    it('should return a number', () => {
      const { result } = renderHook(() => useUnreadCount());

      expect(typeof result.current).toBe('number');
    });
  });
});
