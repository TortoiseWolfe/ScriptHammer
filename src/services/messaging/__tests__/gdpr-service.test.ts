/**
 * Unit tests for GDPRService
 * Tasks: T189, T190
 *
 * Tests exportUserData() and deleteUserAccount() methods
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GDPRService } from '../gdpr-service';
import * as supabaseClient from '@/lib/supabase/client';
import * as encryptionService from '@/lib/messaging/encryption';
import * as keyManagementService from '../key-service';
import * as messagingDb from '@/lib/messaging/database';

// Mock Supabase client
vi.mock('@/lib/supabase/client');
vi.mock('@/lib/messaging/encryption');
vi.mock('../key-service');
vi.mock('@/lib/messaging/database');

describe('GDPRService', () => {
  let gdprService: GDPRService;
  let mockSupabase: any;

  beforeEach(() => {
    gdprService = new GDPRService();

    // Reset mocks
    vi.clearAllMocks();

    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };

    vi.mocked(supabaseClient.createClient).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportUserData()', () => {
    it('should export user data with decrypted messages (T189)', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });

      // Mock user profile
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    username: 'testuser',
                    display_name: 'Test User',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'user_connections') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({
                data: [
                  {
                    status: 'accepted',
                    requester_id: 'user-123',
                    addressee_id: 'user-456',
                    created_at: '2025-01-01T00:00:00Z',
                    requester: { username: 'testuser' },
                    addressee: { username: 'friend1' },
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'conv-123',
                    participant_1_id: 'user-123',
                    participant_2_id: 'user-456',
                    participant_1: { username: 'testuser' },
                    participant_2: { username: 'friend1' },
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'msg-123',
                      conversation_id: 'conv-123',
                      sender_id: 'user-123',
                      encrypted_content: 'encrypted-data',
                      initialization_vector: 'iv-data',
                      created_at: '2025-01-01T12:00:00Z',
                      edited: false,
                      deleted: false,
                      edited_at: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      // Mock encryption service
      vi.mocked(
        encryptionService.encryptionService.getPrivateKey
      ).mockResolvedValue({
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
        d: 'test-d',
      });

      vi.mocked(
        keyManagementService.keyManagementService.getUserPublicKey
      ).mockResolvedValue({
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
      });

      // Mock crypto.subtle
      vi.stubGlobal('crypto', {
        subtle: {
          importKey: vi.fn().mockResolvedValue({}),
        },
      });

      vi.mocked(
        encryptionService.encryptionService.deriveSharedSecret
      ).mockResolvedValue({} as CryptoKey);
      vi.mocked(
        encryptionService.encryptionService.decryptMessage
      ).mockResolvedValue('Hello, World!');

      // Execute export
      const result = await gdprService.exportUserData();

      // Assertions
      expect(result).toMatchObject({
        user_id: 'user-123',
        profile: {
          username: 'testuser',
          display_name: 'Test User',
          email: 'test@example.com',
        },
        connections: [
          {
            type: 'accepted',
            username: 'friend1',
            since: '2025-01-01T00:00:00Z',
          },
        ],
        conversations: [
          {
            conversation_id: 'conv-123',
            participant: 'friend1',
            messages: [
              {
                id: 'msg-123',
                sender: 'you',
                content: 'Hello, World!',
                timestamp: '2025-01-01T12:00:00Z',
                edited: false,
                deleted: false,
              },
            ],
          },
        ],
        statistics: {
          total_conversations: 1,
          total_messages_sent: 1,
          total_messages_received: 0,
          total_connections: 1,
        },
      });

      expect(result.export_date).toBeDefined();
    });

    it('should throw AuthenticationError if user not signed in (T189)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      await expect(gdprService.exportUserData()).rejects.toThrow(
        'You must be signed in to export your data'
      );
    });

    it('should handle messages with decryption errors gracefully (T189)', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });

      // Mock basic data (same as above)
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { username: 'testuser', display_name: 'Test User' },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'user_connections') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }

        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'conv-123',
                    participant_1_id: 'user-123',
                    participant_2_id: 'user-456',
                    participant_1: { username: 'testuser' },
                    participant_2: { username: 'friend1' },
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'msg-123',
                      conversation_id: 'conv-123',
                      sender_id: 'user-123',
                      encrypted_content: 'encrypted-data',
                      initialization_vector: 'iv-data',
                      created_at: '2025-01-01T12:00:00Z',
                      edited: false,
                      deleted: false,
                      edited_at: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      // Mock encryption service to throw error
      vi.mocked(
        encryptionService.encryptionService.getPrivateKey
      ).mockResolvedValue({
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
        d: 'test-d',
      });

      vi.mocked(
        keyManagementService.keyManagementService.getUserPublicKey
      ).mockResolvedValue({
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
      });

      vi.stubGlobal('crypto', {
        subtle: {
          importKey: vi.fn().mockResolvedValue({}),
        },
      });

      vi.mocked(
        encryptionService.encryptionService.deriveSharedSecret
      ).mockResolvedValue({} as CryptoKey);

      // Make decryptMessage throw error
      vi.mocked(
        encryptionService.encryptionService.decryptMessage
      ).mockRejectedValue(new Error('Decryption failed'));

      // Execute export
      const result = await gdprService.exportUserData();

      // Should include error message instead of decrypted content
      expect(result.conversations[0].messages[0].content).toBe(
        '[Message could not be decrypted]'
      );
    });
  });

  describe('deleteUserAccount()', () => {
    it('should delete all user data and sign out (T190)', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });

      // Mock IndexedDB deletions
      const mockPrivateKeysDelete = vi.fn().mockResolvedValue(undefined);
      const mockQueuedMessagesDelete = vi.fn().mockResolvedValue(undefined);
      const mockCachedMessagesDelete = vi.fn().mockResolvedValue(undefined);

      vi.mocked(messagingDb.messagingDb).messaging_private_keys = {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: mockPrivateKeysDelete,
          }),
        }),
      } as any;

      vi.mocked(messagingDb.messagingDb).messaging_queued_messages = {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: mockQueuedMessagesDelete,
          }),
        }),
      } as any;

      vi.mocked(messagingDb.messagingDb).messaging_cached_messages = {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: mockCachedMessagesDelete,
          }),
        }),
      } as any;

      // Mock user_profiles delete
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      // Mock sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      // Execute deletion
      await gdprService.deleteUserAccount();

      // Verify IndexedDB deletions
      expect(mockPrivateKeysDelete).toHaveBeenCalled();
      expect(mockQueuedMessagesDelete).toHaveBeenCalled();
      expect(mockCachedMessagesDelete).toHaveBeenCalled();

      // Verify Supabase deletion
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');

      // Verify sign out
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should throw AuthenticationError if user not signed in (T190)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      await expect(gdprService.deleteUserAccount()).rejects.toThrow(
        'You must be signed in to delete your account'
      );
    });

    it('should throw ConnectionError if deletion fails (T190)', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });

      // Mock IndexedDB deletions (succeed)
      vi.mocked(messagingDb.messagingDb).messaging_private_keys = {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      } as any;

      vi.mocked(messagingDb.messagingDb).messaging_queued_messages = {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      } as any;

      vi.mocked(messagingDb.messagingDb).messaging_cached_messages = {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            delete: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      } as any;

      // Mock user_profiles delete to fail
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: new Error('Database error'),
          }),
        }),
      });

      await expect(gdprService.deleteUserAccount()).rejects.toThrow(
        'Failed to delete account: Database error'
      );
    });
  });
});
