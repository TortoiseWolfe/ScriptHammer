/**
 * Unit Tests for GroupService
 * Feature 010: Group Chats
 * T022: Write unit tests for GroupService.createGroup()
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GROUP_CONSTRAINTS,
  MembershipError,
  ValidationError,
} from '@/types/messaging';

// Use vi.hoisted to define mocks that can be referenced in vi.mock
const { mockGetUser, mockFrom, mockMsgFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(() => ({
    data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    error: null,
  })),
  mockFrom: vi.fn(),
  mockMsgFrom: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: vi.fn(() => ({
    from: mockMsgFrom,
  })),
}));

vi.mock('@/services/messaging/group-key-service', () => ({
  GroupKeyService: vi.fn().mockImplementation(() => ({
    generateGroupKey: vi.fn(() =>
      crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ])
    ),
    distributeGroupKey: vi.fn(() =>
      Promise.resolve({
        successful: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
        pending: [],
      })
    ),
    clearCache: vi.fn(),
  })),
}));

// Mock keyManagementService for encryption key validation
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    getCurrentKeys: vi.fn(() => ({
      publicKey: {},
      privateKey: {},
    })),
    getUserPublicKey: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { GroupService } from '@/services/messaging/group-service';

/** What createGroup sent to `conversations`, and what it deleted (#1247 B2). */
const convInserts: Record<string, unknown>[] = [];
const convDeletes: { col: string; val: string; readBack: boolean }[] = [];
const convReturning = vi.fn();

describe('GroupService', () => {
  let service: GroupService;

  beforeEach(() => {
    service = new GroupService();
    vi.clearAllMocks();
    convInserts.length = 0;
    convDeletes.length = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_connections') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: [
                  {
                    requester_id: '11111111-1111-4111-8111-111111111111',
                    addressee_id: '22222222-2222-4222-8222-222222222222',
                    status: 'accepted',
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === 'user_encryption_keys') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              data: [{ user_id: '22222222-2222-4222-8222-222222222222' }],
              error: null,
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({ data: [], error: null })),
      };
    });

    mockMsgFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        // The row as the database would hold it, under whatever id the client sent (#1247 B2).
        const row = () => ({
          id: (convInserts.at(-1)?.id as string) ?? 'new-conv-id',
          is_group: true,
          group_name: 'Test Group',
          created_by: '11111111-1111-4111-8111-111111111111',
          current_key_version: 1,
          created_at: new Date().toISOString(),
          last_message_at: null,
        });
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            convInserts.push(payload);
            // Awaiting the insert itself is return=minimal; `.select()` would be RETURNING.
            return Object.assign(Promise.resolve({ error: null }), {
              select: convReturning.mockImplementation(() => ({
                single: vi.fn(() => ({ data: row(), error: null })),
              })),
            });
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: row(), error: null })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => {
              const entry = { col, val, readBack: false };
              convDeletes.push(entry);
              return Object.assign(Promise.resolve({ error: null }), {
                select: vi.fn(() => {
                  entry.readBack = true;
                  return { data: [{ id: val }], error: null };
                }),
              });
            }),
          })),
        };
      }

      if (table === 'conversation_members') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              data: [
                {
                  id: 'm1',
                  conversation_id: 'new-conv-id',
                  user_id: '11111111-1111-4111-8111-111111111111',
                  role: 'owner',
                  key_version_joined: 1,
                  key_status: 'active',
                  joined_at: new Date().toISOString(),
                  left_at: null,
                  archived: false,
                  muted: false,
                },
                {
                  id: 'm2',
                  conversation_id: 'new-conv-id',
                  user_id: '22222222-2222-4222-8222-222222222222',
                  role: 'member',
                  key_version_joined: 1,
                  key_status: 'active',
                  joined_at: new Date().toISOString(),
                  left_at: null,
                  archived: false,
                  muted: false,
                },
              ],
              error: null,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
          })),
        };
      }

      if (table === 'group_keys') {
        return {
          insert: vi.fn(() => ({ error: null })),
        };
      }

      return {
        select: vi.fn(() => ({ data: [], error: null })),
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroup()', () => {
    describe('validation', () => {
      it('should throw if no members provided', async () => {
        await expect(service.createGroup({ member_ids: [] })).rejects.toThrow(
          MembershipError
        );
      });

      it('should throw if too many members (>200)', async () => {
        const tooMany = Array.from({ length: 201 }, (_, i) => `user-${i}`);

        await expect(
          service.createGroup({ member_ids: tooMany })
        ).rejects.toThrow(MembershipError);
      });

      it('should throw if user not authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({
          data: { user: null } as any,
          error: { message: 'Not authenticated' } as any,
        });

        await expect(
          service.createGroup({
            member_ids: ['33333333-3333-4333-8333-333333333333'],
          })
        ).rejects.toThrow();
      });

      it('should throw if member is not connected', async () => {
        mockFrom.mockImplementation((table: string) => {
          if (table === 'user_connections') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    data: [],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {
            select: vi.fn(() => ({ data: [], error: null })),
          };
        });

        await expect(
          service.createGroup({
            member_ids: ['44444444-4444-4444-8444-444444444444'],
          })
        ).rejects.toThrow(MembershipError);
      });
    });

    describe('member management', () => {
      it('should set creator as owner', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['22222222-2222-4222-8222-222222222222'],
        });

        const owner = result.members.find((m) => m.role === 'owner');
        expect(owner).toBeDefined();
        expect(owner?.user_id).toBe('11111111-1111-4111-8111-111111111111');
      });

      it('should initialize key_version_joined to 1', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['22222222-2222-4222-8222-222222222222'],
        });

        result.members.forEach((m) => {
          expect(m.key_version_joined).toBe(1);
        });
      });
    });

    describe('conversation creation', () => {
      it('should set is_group to true', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['22222222-2222-4222-8222-222222222222'],
        });

        expect(result.conversation.is_group).toBe(true);
      });

      it('should set created_by to current user', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['22222222-2222-4222-8222-222222222222'],
        });

        expect(result.conversation.created_by).toBe(
          '11111111-1111-4111-8111-111111111111'
        );
      });

      it('sends its own id and never reads the new row back through RETURNING (#1247 B2)', async () => {
        // RETURNING on the insert is evaluated against the conversations SELECT policy, which a
        // helper cannot satisfy for a row its own statement inserted. A client-chosen id makes the
        // insert independent of that, and lets every later step (seat, rollback) name the row.
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['22222222-2222-4222-8222-222222222222'],
        });

        const sent = convInserts[0]?.id;
        expect(sent).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
        expect(convReturning).not.toHaveBeenCalled();
        expect(result.conversation.id).toBe(sent);
      });

      it('a failed seat rolls back the row it created and checks what the delete removed', async () => {
        const base = mockMsgFrom.getMockImplementation()!;
        mockMsgFrom.mockImplementation((table: string) =>
          table === 'conversation_members'
            ? {
                insert: vi.fn(() => ({
                  select: vi.fn(() => ({
                    data: null,
                    error: { message: 'seat refused' },
                  })),
                })),
              }
            : base(table)
        );

        await expect(
          service.createGroup({
            name: 'Test',
            member_ids: ['22222222-2222-4222-8222-222222222222'],
          })
        ).rejects.toThrow(/failed to add group members/i);

        // Read back, because a delete RLS refuses matches 0 rows and reports no error.
        expect(convDeletes).toEqual([
          { col: 'id', val: convInserts[0].id, readBack: true },
        ]);
      });

      it('should set current_key_version to 1', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['22222222-2222-4222-8222-222222222222'],
        });

        expect(result.conversation.current_key_version).toBe(1);
      });
    });

    describe('error handling', () => {
      it('should prevent duplicate member IDs', async () => {
        await expect(
          service.createGroup({
            member_ids: [
              '22222222-2222-4222-8222-222222222222',
              '22222222-2222-4222-8222-222222222222',
            ],
          })
        ).rejects.toThrow();
      });

      it('should prevent adding self as member', async () => {
        await expect(
          service.createGroup({
            member_ids: ['11111111-1111-4111-8111-111111111111'],
          })
        ).rejects.toThrow();
      });

      it('should validate name length (max 100 chars)', async () => {
        const longName = 'A'.repeat(101);

        await expect(
          service.createGroup({
            name: longName,
            member_ids: ['22222222-2222-4222-8222-222222222222'],
          })
        ).rejects.toThrow();
      });

      it('should reject a malformed (non-UUID) member id before it reaches any query', async () => {
        // Guards against PostgREST filter injection via getConnectedUserIds's
        // .or(...) interpolation — a crafted member id must never reach the DB.
        await expect(
          service.createGroup({
            member_ids: ['not-a-uuid,requester_id.eq.injected'],
          })
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('GROUP_CONSTRAINTS', () => {
    it('should have MAX_MEMBERS = 200', () => {
      expect(GROUP_CONSTRAINTS.MAX_MEMBERS).toBe(200);
    });

    it('should have MIN_MEMBERS = 2', () => {
      expect(GROUP_CONSTRAINTS.MIN_MEMBERS).toBe(2);
    });

    it('should have MAX_NAME_LENGTH = 100', () => {
      expect(GROUP_CONSTRAINTS.MAX_NAME_LENGTH).toBe(100);
    });
  });
});
