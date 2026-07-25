/**
 * Unit Test: ConnectionService
 * Task: T032
 *
 * Tests ConnectionService methods with mocked Supabase client.
 * No network dependency - fast, reliable unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConnectionError } from '@/types/messaging';

// Valid test UUIDs
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';
const USER_1_ID = '00000000-0000-0000-0000-000000000002';
const USER_2_ID = '00000000-0000-0000-0000-000000000003';
const CONN_1_ID = '00000000-0000-0000-0000-000000000010';
const ACCESS_TOKEN = 'test-access-token';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
} as unknown as SupabaseClient;

// Mock the createClient function
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Import after mocks are set up
const { connectionService, ConnectionService } = await import(
  '../connection-service'
);

describe('ConnectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: mock authenticated user (getSession used by getAuthenticatedUser
    // helper). access_token is what authContextFromSession puts on the
    // AuthContext handed to the messaging provider.
    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
      data: {
        session: { user: { id: CURRENT_USER_ID }, access_token: ACCESS_TOKEN },
      },
      error: null,
    } as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    } as any);
  });

  describe('searchUsers', () => {
    it('should validate minimum query length', async () => {
      await expect(
        connectionService.searchUsers({ query: 'ab', limit: 10 })
      ).rejects.toThrow('Search query must be at least 3 characters');
    });

    it('should handle authentication errors', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        connectionService.searchUsers({ query: 'test@example.com', limit: 10 })
      ).rejects.toThrow('You must be signed in');
    });
  });

  describe('sendFriendRequest', () => {
    it('should require authentication', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        connectionService.sendFriendRequest({
          addressee_id: USER_2_ID,
        })
      ).rejects.toThrow('You must be signed in');
    });
  });

  describe('respondToRequest', () => {
    it('should validate UUID format', async () => {
      await expect(
        connectionService.respondToRequest({
          connection_id: 'invalid-uuid',
          action: 'accept',
        })
      ).rejects.toThrow('Invalid connection_id format');
    });

    it('should reject invalid actions', async () => {
      await expect(
        connectionService.respondToRequest({
          connection_id: CONN_1_ID,
          action: 'invalid' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('getConnections', () => {
    it('should require authentication', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(connectionService.getConnections()).rejects.toThrow(
        'You must be signed in'
      );
    });
  });

  describe('removeConnection', () => {
    it('should validate UUID format', async () => {
      await expect(
        connectionService.removeConnection('invalid-uuid')
      ).rejects.toThrow('Invalid connection_id format');
    });
  });

  describe('getOrCreateConversation', () => {
    const CONVERSATION_ID = '00000000-0000-0000-0000-000000000100';

    it('should require authentication', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        connectionService.getOrCreateConversation(USER_2_ID)
      ).rejects.toThrow('You must be signed in to start a conversation');
    });

    it('should validate UUID format', async () => {
      await expect(
        connectionService.getOrCreateConversation('invalid-uuid')
      ).rejects.toThrow('Invalid otherUserId format');
    });

    it('should prevent self-conversation', async () => {
      await expect(
        connectionService.getOrCreateConversation(CURRENT_USER_ID)
      ).rejects.toThrow('You cannot start a conversation with yourself');
    });

    // ── The #265 seam ──────────────────────────────────────────────────────
    // The C3 connection gate, canonical ordering, the existing-conversation
    // lookup and the unique-violation race all live BELOW the provider seam
    // now, so each backend enforces them its own way and the shared conformance
    // suite (tests/contract/) proves both do. What is this service's job — and
    // therefore what these tests cover — is the above-seam guards and the
    // hand-off itself.

    it('delegates to the messaging provider with the caller AuthContext', async () => {
      const providerCall = vi.fn().mockResolvedValue(CONVERSATION_ID);
      const service = new ConnectionService({
        getOrCreateConversation: providerCall,
      } as any);

      const result = await service.getOrCreateConversation(USER_2_ID);

      expect(result).toBe(CONVERSATION_ID);
      expect(providerCall).toHaveBeenCalledWith(
        { userId: CURRENT_USER_ID, accessToken: ACCESS_TOKEN },
        USER_2_ID
      );
      // No direct table access: a regression to querying Supabase here would
      // silently strand the .NET backend, which has no RLS to fall back on.
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('surfaces the provider ConnectionError when users are not connected (C3)', async () => {
      const service = new ConnectionService({
        getOrCreateConversation: vi
          .fn()
          .mockRejectedValue(
            new ConnectionError(
              'You must be connected with this user to start a conversation'
            )
          ),
      } as any);

      await expect(service.getOrCreateConversation(USER_2_ID)).rejects.toThrow(
        'You must be connected with this user'
      );
    });

    it('does not reach the provider when the above-seam guards reject', async () => {
      const providerCall = vi.fn().mockResolvedValue(CONVERSATION_ID);
      const service = new ConnectionService({
        getOrCreateConversation: providerCall,
      } as any);

      await expect(
        service.getOrCreateConversation('invalid-uuid')
      ).rejects.toThrow('Invalid otherUserId format');
      await expect(
        service.getOrCreateConversation(CURRENT_USER_ID)
      ).rejects.toThrow('You cannot start a conversation with yourself');

      expect(providerCall).not.toHaveBeenCalled();
    });
  });
});
