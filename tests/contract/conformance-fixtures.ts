/**
 * The shared fixture graph for the messaging-provider conformance suite (#266/#265).
 *
 * Both runners (`messaging-provider.supabase.test.ts`,
 * `messaging-provider.dotnet.test.ts`) seed the IDENTICAL rows and differ only in
 * how they build providers. That seeding used to be copy-pasted into both files,
 * which made "edit them in lockstep" a convention nobody could enforce — a change
 * to one silently skewed the two backends' fixtures and the conformance
 * comparison stopped being apples-to-apples. It lives here instead, so the two
 * backends are measured against the same world by construction.
 *
 * Seeded graph (four users):
 *
 *   userA ──accepted──── userB          + a 1:1 conversation  (the shared thread)
 *   userB ──accepted──── outsider       + NO conversation     (C3 positive create)
 *   userA ──PENDING───── pendingUser    + NO conversation     (C3: exists ≠ accepted)
 *   userA ─── (nothing) ─ outsider                            (C3: no connection)
 *   group conversation: userA (creator) + userB active members, outsider excluded
 *
 * The userB↔outsider connection is deliberately stored in the NON-canonical
 * direction (requester = the LARGER uuid). `unique_connection` is
 * `(requester_id, addressee_id)` and is not symmetric, so a single accepted row
 * may point either way — seeding it "backwards" is what proves a provider really
 * checks BOTH orderings rather than only the canonical one.
 *
 * @module tests/contract/conformance-fixtures
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { deleteTestUser } from '../fixtures/test-users';
import type { ConformanceHarness } from './messaging-provider.contract';

/** The four fixture users, already created in `auth.users`. */
export interface FixtureUserIds {
  aId: string;
  bId: string;
  outsiderId: string;
  pendingId: string;
}

/** Everything the seeding produces that a harness needs to expose. */
export interface SeededFixtures {
  conversationId: string;
  groupConversationId: string;
  seedMessage: ConformanceHarness['seedMessage'];
  readMessage: ConformanceHarness['readMessage'];
  readConversation: ConformanceHarness['readConversation'];
  readConversationBetween: ConformanceHarness['readConversationBetween'];
}

/**
 * Canonical ordering for a 1:1 pair: `participant_1_id < participant_2_id`.
 * Plain string comparison matches Postgres `uuid` ordering (both compare the
 * bytes in order), which is what the `canonical_ordering` CHECK enforces.
 */
export function canonicalPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/**
 * Replace whatever connection row exists between two users with exactly one row
 * in the GIVEN direction and status. Service client, so it can build states a
 * normal user could not.
 *
 * THE DIRECTION IS THE POINT (C30/#352). `unique_connection` is
 * `UNIQUE (requester_id, addressee_id)` and is NOT symmetric, so a single block
 * between two people may be stored either way round depending on who pressed the
 * button. A rule that checks one ordering enforces the block only half the time,
 * and the half that fails is silent. Deleting both directions first is what lets
 * a test pin the row to the ordering it wants to exercise.
 */
export async function setConnection(
  svc: SupabaseClient<Database>,
  opts: {
    requesterId: string;
    addresseeId: string;
    status: 'accepted' | 'pending' | 'blocked' | 'declined';
  }
): Promise<void> {
  const { requesterId, addresseeId, status } = opts;

  await svc
    .from('user_connections')
    .delete()
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId);
  await svc
    .from('user_connections')
    .delete()
    .eq('requester_id', addresseeId)
    .eq('addressee_id', requesterId);

  const { error } = await svc.from('user_connections').insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status,
  });
  if (error) {
    throw new Error(
      `setConnection(${status}) failed — the fixture could not build the state ` +
        `the test needs, so a pass below would prove nothing: ${error.message}`
    );
  }
}

/**
 * Seed the shared conformance graph via the SERVICE client (bypassing RLS, so
 * setup can build states a normal user could not — e.g. a pending connection).
 */
export async function seedConformanceFixtures(
  svc: SupabaseClient<Database>,
  users: FixtureUserIds
): Promise<SeededFixtures> {
  const [p1, p2] = canonicalPair(users.aId, users.bId);

  // C3: an accepted connection is required to create the 1:1 conversation below.
  await svc.from('user_connections').insert({
    requester_id: p1,
    addressee_id: p2,
    status: 'accepted',
  });

  // C3 positive-create fixture: connected, but no conversation yet. Stored
  // reversed (requester = larger uuid) to exercise the both-directions rule.
  const [bo1, bo2] = canonicalPair(users.bId, users.outsiderId);
  await svc.from('user_connections').insert({
    requester_id: bo2,
    addressee_id: bo1,
    status: 'accepted',
  });

  // C3 negative fixture: a connection that EXISTS but was never accepted.
  const [ap1, ap2] = canonicalPair(users.aId, users.pendingId);
  await svc.from('user_connections').insert({
    requester_id: ap1,
    addressee_id: ap2,
    status: 'pending',
  });

  const { data: conv, error: convErr } = await svc
    .from('conversations')
    .insert({
      participant_1_id: p1,
      participant_2_id: p2,
      is_group: false,
      current_key_version: 1,
    })
    .select()
    .single();
  if (convErr || !conv) {
    throw new Error(
      `Failed to seed conversation: ${convErr?.message ?? 'no row'}`
    );
  }
  const conversationId = conv.id;

  // A GROUP conversation with userA (creator) + userB as active members;
  // the outsider is deliberately NOT a member (C1/C2 scoping).
  const { data: group, error: groupErr } = await svc
    .from('conversations')
    .insert({
      // Groups carry NULL participants (check_group_participants); membership
      // is in conversation_members. Access is creator-or-active-member only.
      participant_1_id: null,
      participant_2_id: null,
      is_group: true,
      current_key_version: 1,
      created_by: users.aId,
    })
    .select()
    .single();
  if (groupErr || !group) {
    throw new Error(
      `Failed to seed group conversation: ${groupErr?.message ?? 'no row'}`
    );
  }
  const groupConversationId = group.id;
  await svc.from('conversation_members').insert([
    { conversation_id: groupConversationId, user_id: users.aId },
    { conversation_id: groupConversationId, user_id: users.bId },
  ]);

  // Direct seed/read helpers via the service client (bypass RLS + control
  // created_at / sequence so we can exercise the rules against known rows).
  const seedMessage: ConformanceHarness['seedMessage'] = async ({
    senderId,
    ciphertext = 'c2VlZA==',
    createdAtIso,
    conversationId: convId,
  }) => {
    const row: Record<string, unknown> = {
      conversation_id: convId ?? conversationId,
      sender_id: senderId,
      encrypted_content: ciphertext,
      initialization_vector: 'aXY=',
      sequence_number: 0, // trigger overrides
      key_version: 1,
    };
    if (createdAtIso) row.created_at = createdAtIso;
    const { data, error } = await svc
      .from('messages')
      .insert(row as never)
      .select('id')
      .single();
    if (error || !data) {
      throw new Error(`seedMessage failed: ${error?.message ?? 'no row'}`);
    }
    return { id: (data as { id: string }).id };
  };

  const readMessage: ConformanceHarness['readMessage'] = async (id) => {
    const { data } = await svc
      .from('messages')
      .select(
        'id, deleted, edited, encrypted_content, read_at, delivered_at, sequence_number'
      )
      .eq('id', id)
      .maybeSingle();
    return data ?? null;
  };

  const readConversation: ConformanceHarness['readConversation'] = async (
    id
  ) => {
    const { data } = await svc
      .from('conversations')
      .select(
        'id, is_group, participant_1_id, archived_by_participant_1, archived_by_participant_2'
      )
      .eq('id', id)
      .maybeSingle();
    return data ?? null;
  };

  const readConversationBetween: ConformanceHarness['readConversationBetween'] =
    async (userX, userY) => {
      const [c1, c2] = canonicalPair(userX, userY);
      const { data } = await svc
        .from('conversations')
        .select('id')
        .eq('participant_1_id', c1)
        .eq('participant_2_id', c2)
        .maybeSingle();
      return data?.id ?? null;
    };

  return {
    conversationId,
    groupConversationId,
    seedMessage,
    readMessage,
    readConversation,
    readConversationBetween,
  };
}

/**
 * Drop everything {@link seedConformanceFixtures} created, plus anything the
 * suite itself created along the way.
 *
 * Deliberately deletes 1:1 conversations by PARTICIPANT rather than by a fixed
 * id list: the C3 cases create a conversation whose id setup never knew, and an
 * id-list teardown would orphan it into the shared backend.
 */
export async function teardownConformanceFixtures(
  svc: SupabaseClient<Database>,
  h: ConformanceHarness
): Promise<void> {
  const ids = [h.userAId, h.userBId, h.outsiderId, h.pendingUserId];

  await svc
    .from('conversation_members')
    .delete()
    .eq('conversation_id', h.groupConversationId);

  // Every 1:1 among the fixture users (canonical ordering guarantees one of them
  // is participant_1), then the group. Cascade drops the messages.
  await svc.from('conversations').delete().in('participant_1_id', ids);
  await svc.from('conversations').delete().eq('id', h.groupConversationId);

  // Both columns: the userB↔outsider row is stored reversed, and teardown must
  // not depend on which way a row happens to point.
  await svc.from('user_connections').delete().in('requester_id', ids);
  await svc.from('user_connections').delete().in('addressee_id', ids);

  for (const id of ids) {
    await deleteTestUser(id).catch(() => {});
  }
}
