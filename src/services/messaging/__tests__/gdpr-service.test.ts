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
        getSession: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
      functions: { invoke: vi.fn() },
    };

    vi.mocked(supabaseClient.createClient).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportUserData()', () => {
    it('should export user data with decrypted messages (T189)', async () => {
      // Mock authenticated user
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
          },
        },
        error: null,
      });
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

        // #248: no group memberships in the 1:1-only tests → the group export
        // branch is a no-op. Mock must expose .eq().is() (the real query is
        // .select('conversation_id').eq('user_id').is('left_at', null)).
        if (table === 'conversation_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
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

      // Mock encryption service. getPrivateKey now returns a CryptoKey
      // (non-extractable) — for unit test purposes a stub object is fine
      // since downstream calls into encryptionService are also mocked.
      vi.mocked(
        encryptionService.encryptionService.getPrivateKey
      ).mockResolvedValue({} as CryptoKey);

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
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Not authenticated'),
      });
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
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
          },
        },
        error: null,
      });
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

        // #248: no group memberships in the 1:1-only tests → the group export
        // branch is a no-op. Mock must expose .eq().is() (the real query is
        // .select('conversation_id').eq('user_id').is('left_at', null)).
        if (table === 'conversation_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
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

      // Mock encryption service to throw error.
      // getPrivateKey returns a CryptoKey-typed stub.
      vi.mocked(
        encryptionService.encryptionService.getPrivateKey
      ).mockResolvedValue({} as CryptoKey);

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

    it('includes GROUP conversations and their decrypted messages (#248)', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: { user: { id: 'user-123', email: 'test@example.com' } },
        },
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              // sender-name lookup: .select('id, username').in('id', [...])
              if (cols?.includes('id, username')) {
                return {
                  in: vi.fn().mockResolvedValue({
                    data: [{ id: 'user-999', username: 'alice' }],
                    error: null,
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { username: 'testuser', display_name: 'Test User' },
                    error: null,
                  }),
                }),
              };
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
            select: vi.fn().mockImplementation((cols: string) => {
              // group hydration: .select('id, group_name').in('id',[...]).eq('is_group',true)
              if (cols?.includes('group_name')) {
                return {
                  in: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: [{ id: 'group-1', group_name: 'My Group' }],
                      error: null,
                    }),
                  }),
                };
              }
              // 1:1 enumeration: .select(...).or(...) → none
              return {
                or: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        if (table === 'conversation_members') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              // roster: .select('user_id, member:...').eq('conversation_id').is('left_at')
              if (cols?.includes('member:')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    is: vi.fn().mockResolvedValue({
                      data: [
                        {
                          user_id: 'user-123',
                          member: { username: 'testuser' },
                        },
                        { user_id: 'user-999', member: { username: 'alice' } },
                      ],
                      error: null,
                    }),
                  }),
                };
              }
              // membership enumeration: .select('conversation_id').eq('user_id').is('left_at')
              return {
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({
                    data: [{ conversation_id: 'group-1' }],
                    error: null,
                  }),
                }),
              };
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
                      id: 'gmsg-1',
                      conversation_id: 'group-1',
                      sender_id: 'user-123',
                      encrypted_content: 'enc',
                      initialization_vector: 'iv',
                      key_version: 1,
                      is_system_message: false,
                      created_at: '2025-02-01T10:00:00Z',
                      edited: false,
                      deleted: false,
                      edited_at: null,
                    },
                    {
                      id: 'gmsg-2',
                      conversation_id: 'group-1',
                      sender_id: 'user-999',
                      encrypted_content: 'enc2',
                      initialization_vector: 'iv2',
                      key_version: 1,
                      is_system_message: false,
                      created_at: '2025-02-01T10:01:00Z',
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

      vi.mocked(
        keyManagementService.keyManagementService.restoreKeysFromCache
      ).mockResolvedValue(true);

      // Stub the shared group-decrypt helper: prove the export threads its
      // output through (the real crypto is covered by the group-key roundtrip
      // test + live verification).
      const groupDecrypt = await import('../group-message-decrypt');
      vi.spyOn(groupDecrypt, 'decryptGroupMessages').mockResolvedValue([
        {
          row: {
            id: 'gmsg-1',
            sender_id: 'user-123',
            created_at: '2025-02-01T10:00:00Z',
            edited: false,
            deleted: false,
            edited_at: null,
          } as any,
          content: 'hi from me',
          decryptionError: false,
        },
        {
          row: {
            id: 'gmsg-2',
            sender_id: 'user-999',
            created_at: '2025-02-01T10:01:00Z',
            edited: false,
            deleted: false,
            edited_at: null,
          } as any,
          content: 'reply from alice',
          decryptionError: false,
        },
      ]);

      const result = await gdprService.exportUserData();

      const group = result.conversations.find((c) => c.is_group);
      expect(group).toBeDefined();
      expect(group).toMatchObject({
        conversation_id: 'group-1',
        is_group: true,
        group_name: 'My Group',
      });
      expect(group!.members).toEqual(
        expect.arrayContaining([
          { user_id: 'user-123', username: 'testuser' },
          { user_id: 'user-999', username: 'alice' },
        ])
      );
      expect(group!.messages).toEqual([
        expect.objectContaining({ sender: 'you', content: 'hi from me' }),
        expect.objectContaining({
          sender: 'alice',
          content: 'reply from alice',
        }),
      ]);
      // one sent (me), one received (alice)
      expect(result.statistics.total_messages_sent).toBe(1);
      expect(result.statistics.total_messages_received).toBe(1);
      // keys restored before group decrypt (cold-load guard, #248 verifier fix)
      expect(
        keyManagementService.keyManagementService.restoreKeysFromCache
      ).toHaveBeenCalledWith('user-123');
    });
  });

  describe('deleteUserAccount()', () => {
    it('should delete all user data and sign out (T190)', async () => {
      // Mock authenticated user
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
          },
        },
        error: null,
      });
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

      // Deletion is server-side now (#859).
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      // Mock sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      // Execute deletion
      await gdprService.deleteUserAccount();

      // Verify IndexedDB deletions
      expect(mockPrivateKeysDelete).toHaveBeenCalled();
      expect(mockQueuedMessagesDelete).toHaveBeenCalled();
      expect(mockCachedMessagesDelete).toHaveBeenCalled();

      // This assertion used to read `expect(mockSupabase.from).toHaveBeenCalledWith(
      // 'user_profiles')`, and it PASSED for as long as the feature deleted nothing —
      // the mock returned `{ error: null }`, which is exactly what RLS returned in
      // production when it filtered the statement to zero rows. Asserting that a call
      // was made can never catch a call that does nothing.
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'delete-account',
        expect.objectContaining({ method: 'POST' })
      );
      // No user id is passed, and none must be: the function holds the service role and
      // takes the account to delete from the verified JWT alone.
      const [, invokeOptions] = mockSupabase.functions.invoke.mock.calls[0];
      expect(JSON.stringify(invokeOptions ?? {})).not.toContain('user-123');

      // The client must NOT try to delete the profile itself any more.
      expect(mockSupabase.from).not.toHaveBeenCalledWith('user_profiles');

      // Verify sign out
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('throws when the function reports failure in its BODY, not just on transport (#859)', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123', email: 't@e.com' } } },
        error: null,
      });
      for (const table of [
        'messaging_private_keys',
        'messaging_queued_messages',
        'messaging_cached_messages',
      ]) {
        (vi.mocked(messagingDb.messagingDb) as any)[table] = {
          where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({ delete: vi.fn() }),
          }),
        };
      }

      // A 200 with an error payload. This is the shape the whole bug was about:
      // "no transport error" is not the same as "the account was deleted".
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          error: 'Account deletion reported success but the user still exists',
        },
        error: null,
      });
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await expect(gdprService.deleteUserAccount()).rejects.toThrow(
        /still exists/
      );

      // And critically: the user is NOT signed out on a failed deletion. Signing them
      // out is what made the original defect look like success.
      expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
    });

    it('throws when the function invocation itself errors (#859)', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123', email: 't@e.com' } } },
        error: null,
      });
      for (const table of [
        'messaging_private_keys',
        'messaging_queued_messages',
        'messaging_cached_messages',
      ]) {
        (vi.mocked(messagingDb.messagingDb) as any)[table] = {
          where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({ delete: vi.fn() }),
          }),
        };
      }

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Edge Function returned a non-2xx status code'),
      });
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await expect(gdprService.deleteUserAccount()).rejects.toThrow(
        /Failed to delete account/
      );
      expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError if user not signed in (T190)', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Not authenticated'),
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      await expect(gdprService.deleteUserAccount()).rejects.toThrow(
        'You must be signed in to delete your account'
      );
    });

    it('should throw ConnectionError if deletion fails (T190)', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: { user: { id: 'user-123', email: 'test@example.com' } },
        },
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      for (const table of [
        'messaging_private_keys',
        'messaging_queued_messages',
        'messaging_cached_messages',
      ]) {
        (vi.mocked(messagingDb.messagingDb) as any)[table] = {
          where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({ delete: vi.fn() }),
          }),
        };
      }

      // Was a mocked `from('user_profiles').delete()` failure. Deletion is server-side
      // now (#859), so the failure that matters is the function reporting one.
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await expect(gdprService.deleteUserAccount()).rejects.toThrow(
        'Failed to delete account: Database error'
      );
    });
  });
});
