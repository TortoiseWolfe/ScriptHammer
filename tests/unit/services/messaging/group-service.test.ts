/**
 * Unit Tests for GroupService
 * Feature 010: Group Chats
 * T022: Write unit tests for GroupService.createGroup()
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GROUP_CONSTRAINTS, MembershipError } from '@/types/messaging';

// Use vi.hoisted to define mocks that can be referenced in vi.mock
const { mockGetUser, mockFrom, mockMsgFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(() => ({
    data: { user: { id: 'current-user-id' } },
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
        successful: ['current-user-id', 'member-1'],
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

describe('GroupService', () => {
  let service: GroupService;

  beforeEach(() => {
    service = new GroupService();
    vi.clearAllMocks();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_connections') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: [
                  {
                    requester_id: 'current-user-id',
                    addressee_id: 'member-1',
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
              data: [{ user_id: 'member-1' }],
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
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  id: 'new-conv-id',
                  is_group: true,
                  group_name: 'Test Group',
                  created_by: 'current-user-id',
                  current_key_version: 1,
                  created_at: new Date().toISOString(),
                  last_message_at: null,
                },
                error: null,
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
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
                  user_id: 'current-user-id',
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
                  user_id: 'member-1',
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
          service.createGroup({ member_ids: ['user-1'] })
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
          service.createGroup({ member_ids: ['unconnected-user'] })
        ).rejects.toThrow(MembershipError);
      });
    });

    describe('member management', () => {
      it('should set creator as owner', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['member-1'],
        });

        const owner = result.members.find((m) => m.role === 'owner');
        expect(owner).toBeDefined();
        expect(owner?.user_id).toBe('current-user-id');
      });

      it('should initialize key_version_joined to 1', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['member-1'],
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
          member_ids: ['member-1'],
        });

        expect(result.conversation.is_group).toBe(true);
      });

      it('should set created_by to current user', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['member-1'],
        });

        expect(result.conversation.created_by).toBe('current-user-id');
      });

      it('should set current_key_version to 1', async () => {
        const result = await service.createGroup({
          name: 'Test',
          member_ids: ['member-1'],
        });

        expect(result.conversation.current_key_version).toBe(1);
      });
    });

    describe('error handling', () => {
      it('should prevent duplicate member IDs', async () => {
        await expect(
          service.createGroup({
            member_ids: ['member-1', 'member-1'],
          })
        ).rejects.toThrow();
      });

      it('should prevent adding self as member', async () => {
        await expect(
          service.createGroup({
            member_ids: ['current-user-id'],
          })
        ).rejects.toThrow();
      });

      it('should validate name length (max 100 chars)', async () => {
        const longName = 'A'.repeat(101);

        await expect(
          service.createGroup({ name: longName, member_ids: ['member-1'] })
        ).rejects.toThrow();
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
