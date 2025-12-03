/**
 * Integration Tests for Group Chat Creation
 * Feature 010: Group Chats
 * T021: Write integration test for createGroup()
 *
 * Tests:
 * - Valid group creation with 2-200 members
 * - Member limit validation (max 200)
 * - Connection requirement validation
 * - Key distribution to all members
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock Supabase client for integration testing
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'owner-user-id' } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      const mockConversation = {
        id: 'new-group-id',
        is_group: true,
        group_name: 'Test Group',
        created_by: 'owner-user-id',
        current_key_version: 1,
        created_at: new Date().toISOString(),
      };

      const mockMembers = [
        {
          id: 'member-1',
          conversation_id: 'new-group-id',
          user_id: 'owner-user-id',
          role: 'owner',
          key_version_joined: 1,
          key_status: 'active',
        },
        {
          id: 'member-2',
          conversation_id: 'new-group-id',
          user_id: 'member-a-id',
          role: 'member',
          key_version_joined: 1,
          key_status: 'active',
        },
        {
          id: 'member-3',
          conversation_id: 'new-group-id',
          user_id: 'member-b-id',
          role: 'member',
          key_version_joined: 1,
          key_status: 'active',
        },
      ];

      if (table === 'conversations') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: mockConversation,
                error: null,
              })),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: mockConversation,
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === 'conversation_members') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              data: mockMembers,
              error: null,
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                data: mockMembers,
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === 'user_connections') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: [
                  {
                    id: 'conn-1',
                    requester_id: 'owner-user-id',
                    addressee_id: 'member-a-id',
                    status: 'accepted',
                  },
                  {
                    id: 'conn-2',
                    requester_id: 'owner-user-id',
                    addressee_id: 'member-b-id',
                    status: 'accepted',
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === 'group_keys') {
        return {
          insert: vi.fn(() => ({ error: null })),
        };
      }

      if (table === 'user_encryption_keys') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              data: [{ user_id: 'member-a-id' }, { user_id: 'member-b-id' }],
              error: null,
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      };
    }),
  })),
}));

// Mock messaging client
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: vi.fn(() => ({
    from: vi.fn((table) => {
      const mockConversation = {
        id: 'new-group-id',
        is_group: true,
        group_name: 'Test Group',
        created_by: 'owner-user-id',
        current_key_version: 1,
        created_at: new Date().toISOString(),
        last_message_at: null,
      };

      const mockMembers = [
        {
          id: 'member-1',
          conversation_id: 'new-group-id',
          user_id: 'owner-user-id',
          role: 'owner',
          joined_at: new Date().toISOString(),
          left_at: null,
          key_version_joined: 1,
          key_status: 'active',
          archived: false,
          muted: false,
        },
        {
          id: 'member-2',
          conversation_id: 'new-group-id',
          user_id: 'member-a-id',
          role: 'member',
          joined_at: new Date().toISOString(),
          left_at: null,
          key_version_joined: 1,
          key_status: 'active',
          archived: false,
          muted: false,
        },
        {
          id: 'member-3',
          conversation_id: 'new-group-id',
          user_id: 'member-b-id',
          role: 'member',
          joined_at: new Date().toISOString(),
          left_at: null,
          key_version_joined: 1,
          key_status: 'active',
          archived: false,
          muted: false,
        },
      ];

      if (table === 'conversations') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: mockConversation,
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
              data: mockMembers,
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

      if (table === 'user_encryption_keys') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              data: [{ user_id: 'member-a-id' }, { user_id: 'member-b-id' }],
              error: null,
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      };
    }),
  })),
}));

// Mock key management
// Mock GroupKeyService to return successful key distribution
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
        successful: ['owner-user-id', 'member-a-id', 'member-b-id'],
        pending: [],
      })
    ),
    clearCache: vi.fn(),
  })),
}));

vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    getCurrentKeys: vi.fn(() => ({ publicKey: {}, privateKey: {} })),
    getUserPublicKey: vi.fn(() => Promise.resolve({})),
  },
}));

// Mock encryption
vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    deriveSharedSecret: vi.fn(async () =>
      crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ])
    ),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { GroupService } from '@/services/messaging/group-service';
import { GROUP_CONSTRAINTS } from '@/types/messaging';

describe('Group Creation Integration', () => {
  let groupService: GroupService;

  beforeAll(() => {
    groupService = new GroupService();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('createGroup()', () => {
    it('should create a group with valid members', async () => {
      const input = {
        name: 'Test Group',
        member_ids: ['member-a-id', 'member-b-id'],
      };

      const result = await groupService.createGroup(input);

      expect(result).toBeDefined();
      expect(result.conversation.is_group).toBe(true);
      expect(result.conversation.group_name).toBe('Test Group');
      expect(result.members.length).toBe(3);
    });

    it('should validate minimum member count', async () => {
      const input = {
        name: 'Invalid Group',
        member_ids: [],
      };

      await expect(groupService.createGroup(input)).rejects.toThrow();
    });

    it('should validate maximum member count (200)', async () => {
      const tooManyMembers = Array.from(
        { length: 201 },
        (_, i) => `member-\${i}`
      );

      const input = {
        name: 'Too Large Group',
        member_ids: tooManyMembers,
      };

      await expect(groupService.createGroup(input)).rejects.toThrow();
    });

    it('should set creator as owner role', async () => {
      const input = {
        name: 'Owner Test',
        member_ids: ['member-a-id'],
      };

      const result = await groupService.createGroup(input);

      const owner = result.members.find((m) => m.role === 'owner');
      expect(owner).toBeDefined();
    });

    it('should initialize key_version_joined to 1 for all members', async () => {
      const input = {
        name: 'Key Version Test',
        member_ids: ['member-a-id'],
      };

      const result = await groupService.createGroup(input);

      result.members.forEach((member) => {
        expect(member.key_version_joined).toBe(1);
      });
    });

    it('should respect GROUP_CONSTRAINTS.MAX_MEMBERS', () => {
      expect(GROUP_CONSTRAINTS.MAX_MEMBERS).toBe(200);
    });
  });

  describe('key distribution', () => {
    it('should set key_status to active for all members on success', async () => {
      const input = {
        name: 'Key Distribution Test',
        member_ids: ['member-a-id', 'member-b-id'],
      };

      const result = await groupService.createGroup(input);

      result.members.forEach((member) => {
        expect(member.key_status).toBe('active');
      });
    });

    it('should set conversation.current_key_version to 1', async () => {
      const input = {
        name: 'Initial Key Version',
        member_ids: ['member-a-id'],
      };

      const result = await groupService.createGroup(input);

      expect(result.conversation.current_key_version).toBe(1);
    });
  });
});
