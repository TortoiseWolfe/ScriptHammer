/**
 * Unit Test: ConnectionService
 * Task: T032
 *
 * Tests ConnectionService methods with mocked Supabase client.
 * No network dependency - fast, reliable unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Valid test UUIDs
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';
const USER_1_ID = '00000000-0000-0000-0000-000000000002';
const USER_2_ID = '00000000-0000-0000-0000-000000000003';
const CONN_1_ID = '00000000-0000-0000-0000-000000000010';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
} as unknown as SupabaseClient;

// Mock the createClient function
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Mock query builder
const createMockQueryBuilder = (data: any = null, error: any = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  then: vi.fn((resolve) => resolve({ data, error })),
});

// Import after mocks are set up
const { connectionService } = await import('../connection-service');

describe('ConnectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: mock authenticated user
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

    it('should reject if users are not connected', async () => {
      // Mock: no accepted connection found
      const mockBuilder = createMockQueryBuilder(null, null);
      vi.mocked(mockSupabase.from).mockReturnValue(mockBuilder as any);

      await expect(
        connectionService.getOrCreateConversation(USER_2_ID)
      ).rejects.toThrow('You must be connected with this user');
    });

    it('should return existing conversation ID when conversation exists', async () => {
      // Mock: connection exists and is accepted
      const connectionBuilder = createMockQueryBuilder(
        { status: 'accepted' },
        null
      );
      // Mock: existing conversation found
      const conversationBuilder = createMockQueryBuilder(
        { id: CONVERSATION_ID },
        null
      );

      let callCount = 0;
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'user_connections') {
          return connectionBuilder as any;
        }
        if (table === 'conversations') {
          callCount++;
          if (callCount === 1) {
            // First call - checking for existing
            return conversationBuilder as any;
          }
        }
        return conversationBuilder as any;
      });

      const result = await connectionService.getOrCreateConversation(USER_2_ID);
      expect(result).toBe(CONVERSATION_ID);
    });

    it('should create new conversation when none exists', async () => {
      // Mock: connection exists and is accepted
      const connectionBuilder = createMockQueryBuilder(
        { status: 'accepted' },
        null
      );
      // Mock: no existing conversation, then successful creation
      const noConversationBuilder = createMockQueryBuilder(null, null);
      const createdConversationBuilder = createMockQueryBuilder(
        { id: CONVERSATION_ID },
        null
      );

      let conversationCallCount = 0;
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'user_connections') {
          return connectionBuilder as any;
        }
        if (table === 'conversations') {
          conversationCallCount++;
          if (conversationCallCount === 1) {
            // First call - checking for existing (none found)
            return noConversationBuilder as any;
          }
          // Second call - creating new
          return createdConversationBuilder as any;
        }
        return noConversationBuilder as any;
      });

      const result = await connectionService.getOrCreateConversation(USER_2_ID);
      expect(result).toBe(CONVERSATION_ID);
    });

    it('should handle race condition with unique constraint violation', async () => {
      // Mock: connection exists and is accepted
      const connectionBuilder = createMockQueryBuilder(
        { status: 'accepted' },
        null
      );
      // Mock: no existing conversation initially
      const noConversationBuilder = createMockQueryBuilder(null, null);
      // Mock: creation fails with unique violation
      const uniqueViolationBuilder = {
        ...createMockQueryBuilder(null, {
          code: '23505',
          message: 'unique violation',
        }),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'unique violation' },
        }),
      };
      // Mock: retry finds the conversation
      const retryBuilder = createMockQueryBuilder(
        { id: CONVERSATION_ID },
        null
      );

      let conversationCallCount = 0;
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === 'user_connections') {
          return connectionBuilder as any;
        }
        if (table === 'conversations') {
          conversationCallCount++;
          if (conversationCallCount === 1) {
            // First call - checking for existing (none found)
            return noConversationBuilder as any;
          }
          if (conversationCallCount === 2) {
            // Second call - insert fails with unique violation
            return uniqueViolationBuilder as any;
          }
          // Third call - retry select succeeds
          return retryBuilder as any;
        }
        return noConversationBuilder as any;
      });

      const result = await connectionService.getOrCreateConversation(USER_2_ID);
      expect(result).toBe(CONVERSATION_ID);
    });
  });
});
