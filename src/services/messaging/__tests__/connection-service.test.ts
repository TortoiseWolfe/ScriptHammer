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
});
