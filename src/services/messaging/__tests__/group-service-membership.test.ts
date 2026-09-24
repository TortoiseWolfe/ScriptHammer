/**
 * Unit tests for GroupService member-management methods (#26).
 *
 * Focus: the security-critical contracts —
 *   - owner-only operations reject non-owners
 *   - removeMember / leaveGroup ROTATE the group key (forward secrecy)
 *   - addMembers distributes the CURRENT key (no rotation)
 * Supabase + messaging client + groupKeyService are mocked; no network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const USER = '00000000-0000-0000-0000-000000000001';
const OTHER = '00000000-0000-0000-0000-000000000002';
const CONV = '00000000-0000-0000-0000-00000000000c';

// --- supabase auth + a generic query builder the service's helpers use ---
const getUser = vi.fn();
const mockSupabase = { auth: { getUser: getUser }, from: vi.fn() };
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
  supabase: mockSupabase,
}));

// --- messaging client: chainable builder, configurable per-call ---
const msgState: {
  single: unknown;
  insertError: unknown;
  updateError: unknown;
  deleteError: unknown;
  selectRows: unknown;
  updateRows: unknown[];
} = {
  single: { data: null, error: null },
  insertError: null,
  updateError: null,
  deleteError: null,
  selectRows: { data: [], error: null },
  updateRows: [{ id: 'row' }],
};
/** Every UPDATE payload, in order — so a test can see which step ran first (#1247). */
const updates: Record<string, unknown>[] = [];

function makeBuilder() {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.is = vi.fn(chain);
  b.order = vi.fn(() => Promise.resolve(msgState.selectRows));
  b.single = vi.fn(() => Promise.resolve(msgState.single));
  b.insert = vi.fn(() => Promise.resolve({ error: msgState.insertError }));
  // `.is()` resolves like the real builder AND offers `.select()` for callers that read back
  // what they changed (transferOwnership, #1247).
  const settled = () =>
    Object.assign(Promise.resolve({ error: msgState.updateError }), {
      select: vi.fn(() =>
        Promise.resolve({
          data: msgState.updateRows,
          error: msgState.updateError,
        })
      ),
    });
  b.update = vi.fn((payload: Record<string, unknown>) => {
    updates.push(payload);
    return {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ is: vi.fn(settled) })),
        is: vi.fn(settled),
      })),
    };
  });
  b.delete = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: msgState.deleteError })),
  }));
  return b;
}
// One shared spy, so a test can assert that NO query was issued (#1242). A fresh
// vi.fn per call would make that assertion unobservable, and therefore vacuous.
const msgFrom = vi.fn(() => makeBuilder());
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => ({ from: msgFrom }),
}));

// --- groupKeyService: the service does `new GroupKeyService()`, so mock the
//     CLASS with shared spies on its prototype to assert forward secrecy. ---
const rotateGroupKey = vi.fn(() => Promise.resolve(2));
const distributeGroupKey = vi.fn(() =>
  Promise.resolve({ successful: [OTHER], pending: [] })
);
vi.mock('@/services/messaging/group-key-service', () => ({
  GroupKeyService: class {
    rotateGroupKey = rotateGroupKey;
    distributeGroupKey = distributeGroupKey;
  },
  groupKeyService: { rotateGroupKey, distributeGroupKey },
}));

// keyManagementService is imported by group-service; stub it.
vi.mock('../key-service', () => ({
  keyManagementService: { getCurrentKeys: () => ({}) },
}));

const { GroupService } = await import('../group-service');

describe('GroupService membership (#26)', () => {
  let svc: InstanceType<typeof GroupService>;

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
    // default generic builder for the service's own helper queries
    mockSupabase.from.mockImplementation(() => makeBuilder());
    msgState.single = { data: null, error: null };
    msgState.insertError = null;
    msgState.updateError = null;
    msgState.deleteError = null;
    msgState.selectRows = { data: [], error: null };
    rotateGroupKey.mockResolvedValue(2);
    distributeGroupKey.mockResolvedValue({ successful: [OTHER], pending: [] });
    svc = new GroupService();
  });

  // Helper: make isOwner/isMember resolve a given role for the generic client.
  function asRole(role: 'owner' | 'member' | null) {
    mockSupabase.from.mockImplementation(() => {
      const b: Record<string, unknown> = {};
      const chain = () => b;
      b.select = vi.fn(chain);
      b.eq = vi.fn(chain);
      b.is = vi.fn(chain);
      b.single = vi.fn(() =>
        Promise.resolve({ data: role ? { id: 'm', role } : null, error: null })
      );
      return b;
    });
  }

  describe('removeMember (forward secrecy + owner-only)', () => {
    it('rejects a non-owner', async () => {
      asRole('member'); // caller is a member, not owner
      await expect(svc.removeMember(CONV, OTHER)).rejects.toThrow(
        /owner can remove/i
      );
      expect(rotateGroupKey).not.toHaveBeenCalled();
    });

    it('rotates the group key after removing (forward secrecy)', async () => {
      // isOwner(caller)=owner, isMember(target)=member → both .single() return a row
      asRole('owner');
      await svc.removeMember(CONV, OTHER);
      expect(rotateGroupKey).toHaveBeenCalledWith(CONV);
    });

    it('refuses to remove yourself', async () => {
      asRole('owner');
      await expect(svc.removeMember(CONV, USER)).rejects.toThrow(/leaveGroup/i);
    });
  });

  describe('leaveGroup', () => {
    it('rotates the key when a non-owner member leaves', async () => {
      // isMember=true (row), isOwner=false (role member)
      asRole('member');
      await svc.leaveGroup(CONV);
      expect(rotateGroupKey).toHaveBeenCalledWith(CONV);
    });
  });

  describe('renameGroup (owner-only + validation)', () => {
    it('rejects a non-owner', async () => {
      asRole('member');
      await expect(svc.renameGroup(CONV, 'New')).rejects.toThrow(
        /owner can rename/i
      );
    });

    it('rejects an empty name', async () => {
      asRole('owner');
      await expect(svc.renameGroup(CONV, '   ')).rejects.toThrow(/empty/i);
    });
  });

  describe('deleteGroup (owner-only)', () => {
    it('rejects a non-owner', async () => {
      asRole('member');
      await expect(svc.deleteGroup(CONV)).rejects.toThrow(/owner can delete/i);
    });

    it('allows the owner', async () => {
      asRole('owner');
      await expect(svc.deleteGroup(CONV)).resolves.toBeUndefined();
    });
  });

  describe('transferOwnership', () => {
    it('rejects transferring to yourself', async () => {
      asRole('owner');
      await expect(
        svc.transferOwnership({ conversation_id: CONV, new_owner_id: USER })
      ).rejects.toThrow(/already the owner/i);
    });

    it('rejects a non-owner caller', async () => {
      asRole('member');
      await expect(
        svc.transferOwnership({ conversation_id: CONV, new_owner_id: OTHER })
      ).rejects.toThrow(/owner can transfer/i);
    });

    it('promotes the new owner BEFORE stepping down (#1247)', async () => {
      // Demote-first left groups owner-less: the promotion then matched 0 rows silently.
      asRole('owner');
      updates.length = 0;
      msgState.updateRows = [{ id: 'row' }];
      await svc.transferOwnership({
        conversation_id: CONV,
        new_owner_id: OTHER,
      });
      expect(updates.map((u) => u.role)).toEqual(['owner', 'member']);
    });

    it('a promotion that changed no row fails loudly, and the caller is not demoted', async () => {
      asRole('owner');
      updates.length = 0;
      msgState.updateRows = [];
      await expect(
        svc.transferOwnership({ conversation_id: CONV, new_owner_id: OTHER })
      ).rejects.toThrow(/failed to transfer ownership/i);
      expect(updates.map((u) => u.role)).toEqual(['owner']);
      msgState.updateRows = [{ id: 'row' }];
    });
  });

  describe('auth', () => {
    it('every mutation requires a signed-in user', async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(svc.deleteGroup(CONV)).rejects.toThrow(/signed in/i);
      await expect(svc.renameGroup(CONV, 'x')).rejects.toThrow(/signed in/i);
      await expect(svc.removeMember(CONV, OTHER)).rejects.toThrow(/signed in/i);
    });
  });
});

describe('member id validation (#1242)', () => {
  // A string shaped to escape the `.in.(...)` list inside getConnectedUserIds'
  // `.or(...)` filter. createGroup already refuses it; these two paths did not.
  const CRAFTED = `x),or(requester_id.eq.${USER}`;
  const queries = () =>
    msgFrom.mock.calls.length + mockSupabase.from.mock.calls.length;
  let svc: InstanceType<typeof GroupService>;

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
    mockSupabase.from.mockImplementation(() => makeBuilder());
    msgState.single = { data: null, error: null };
    svc = new GroupService();
  });

  it('addMembers refuses a malformed member id before any query', async () => {
    await expect(
      svc.addMembers({ conversation_id: CONV, member_ids: [CRAFTED] })
    ).rejects.toThrow(/Invalid member_ids format/);
    expect(queries()).toBe(0);
  });

  it('upgradeToGroup refuses a malformed member id before any query', async () => {
    await expect(
      svc.upgradeToGroup({
        conversation_id: CONV,
        name: 'g',
        member_ids: [CRAFTED],
      })
    ).rejects.toThrow(/Invalid member_ids format/);
    expect(queries()).toBe(0);
  });

  it('CONTROL: a well-formed id gets past validation and the harness sees the query', async () => {
    // Proves `queries()` can observe a query at all — otherwise the two zero
    // assertions above would pass against a service that never validates.
    await expect(
      svc.addMembers({ conversation_id: CONV, member_ids: [OTHER] })
    ).rejects.toThrow(/only a group member/i);
    expect(queries()).toBeGreaterThan(0);
  });
});
