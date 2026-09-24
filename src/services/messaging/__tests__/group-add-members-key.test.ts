/**
 * A member added to a group must receive the key the group already uses (#1247 F9).
 *
 * addMembers used to call distributeGroupKey, which GENERATES a new key and wraps it under the
 * group's existing version. The new member could then decrypt nothing anyone else had sent at
 * that version — and nothing anyone sent afterwards either, since everyone else kept encrypting
 * with the original key.
 *
 * This drives the real GroupService.addMembers with real Web Crypto. Only the database is faked:
 * it serves the owner's own wrapped copy of the group key and captures the rows addMembers writes
 * for the newcomer. The newcomer then unwraps their row with their own private key, and the
 * result must be byte-identical to the key the owner holds.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = '00000000-0000-0000-0000-00000000000a';
const NEWCOMER = '00000000-0000-0000-0000-00000000000b';
const CONV = '00000000-0000-0000-0000-00000000000c';

type Pair = { privateKey: CryptoKey; publicKeyJwk: JsonWebKey };

async function ecdhPair(): Promise<Pair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  return {
    privateKey: pair.privateKey,
    publicKeyJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
  };
}

const state: {
  owner?: Pair;
  newcomer?: Pair;
  ownerRow?: Record<string, unknown>;
  keyInserts: Record<string, unknown>[];
} = { keyInserts: [] };

/** A thenable query builder: every chain method returns itself; awaiting resolves `result`. */
function builder(result: () => unknown, onInsert?: (rows: unknown) => void) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'in', 'or', 'order', 'limit', 'lte'])
    b[m] = vi.fn(() => b);
  b.single = vi.fn(async () => result());
  b.maybeSingle = vi.fn(async () => result());
  b.insert = vi.fn((rows: unknown) => {
    onInsert?.(rows);
    return Object.assign(Promise.resolve({ data: null, error: null }), b);
  });
  b.update = vi.fn(() => b);
  b.then = (resolve: (v: unknown) => unknown) => resolve(result());
  return b;
}

// The service's own helper queries (isOwner / isMember / member count / connections / keys).
const supabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: OWNER } },
      error: null,
    })),
  },
  from: vi.fn((table: string) => {
    if (table === 'user_connections') {
      return builder(() => ({
        data: [{ requester_id: OWNER, addressee_id: NEWCOMER }],
        error: null,
      }));
    }
    if (table === 'user_encryption_keys') {
      return builder(() => ({ data: [{ user_id: NEWCOMER }], error: null }));
    }
    // conversation_members: the caller is the owner; the newcomer is not yet seated.
    let userId: string | undefined;
    const b = builder(() => {
      if (userId === OWNER)
        return { data: { id: 'm-owner', role: 'owner' }, error: null };
      if (userId === NEWCOMER) return { data: null, error: null };
      return { data: null, count: 1, error: null };
    });
    b.eq = vi.fn((col: string, val: string) => {
      if (col === 'user_id') userId = val;
      return b;
    });
    return b;
  }),
};
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
  supabase,
}));

// The messaging client: the group row, the owner's own wrapped key, and a capture of new key rows.
const messaging = {
  from: vi.fn((table: string) => {
    if (table === 'conversations') {
      return builder(() => ({
        data: { id: CONV, is_group: true, current_key_version: 1 },
        error: null,
      }));
    }
    if (table === 'group_keys') {
      return builder(
        () => ({ data: state.ownerRow, error: null }),
        (rows) =>
          state.keyInserts.push(...(Array.isArray(rows) ? rows : [rows]))
      );
    }
    if (table === 'conversation_members') {
      return builder(() => ({
        data: [
          {
            id: 'm-new',
            conversation_id: CONV,
            user_id: NEWCOMER,
            role: 'member',
            left_at: null,
          },
        ],
        error: null,
      }));
    }
    return builder(() => ({ data: null, error: null }));
  }),
};
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => messaging,
}));

vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    getCurrentKeys: () => state.owner,
    getUserPublicKey: async (id: string) =>
      id === NEWCOMER ? state.newcomer!.publicKeyJwk : null,
    getUserPublicKeyAt: async () => state.owner!.publicKeyJwk,
    getUserPublicKeyHistory: async (id: string) =>
      id === OWNER ? [state.owner!.publicKeyJwk] : [],
  },
}));

const { GroupService } = await import('../group-service');
const { GroupKeyService } = await import('../group-key-service');

describe('addMembers hands the newcomer the key the group already uses (#1247 F9)', () => {
  let groupKey: CryptoKey;

  beforeEach(async () => {
    state.keyInserts = [];
    state.owner = await ecdhPair();
    state.newcomer = await ecdhPair();
    const gks = new GroupKeyService();
    groupKey = await gks.generateGroupKey();
    // The owner's own row at version 1, wrapped exactly as createGroup wraps it.
    state.ownerRow = {
      encrypted_key: await gks.encryptGroupKeyForMember(
        groupKey,
        state.owner.publicKeyJwk,
        state.owner.privateKey
      ),
      created_by: OWNER,
      creator_public_key: state.owner.publicKeyJwk,
      created_at: '2026-09-24T00:00:00Z',
    };
  });

  it('the newcomer unwraps the same key bytes the owner holds', async () => {
    await new GroupService().addMembers({
      conversation_id: CONV,
      member_ids: [NEWCOMER],
    });

    const row = state.keyInserts.find((r) => r.user_id === NEWCOMER);
    expect(row, 'a key row was written for the newcomer').toBeDefined();
    expect(row!.key_version).toBe(1);

    const unwrapped = await new GroupKeyService().decryptGroupKey(
      row!.encrypted_key as string,
      row!.creator_public_key as JsonWebKey,
      state.newcomer!.privateKey
    );
    const [got, want] = await Promise.all([
      crypto.subtle.exportKey('raw', unwrapped),
      crypto.subtle.exportKey('raw', groupKey),
    ]);
    expect(Buffer.from(got).equals(Buffer.from(want))).toBe(true);
  });
});
