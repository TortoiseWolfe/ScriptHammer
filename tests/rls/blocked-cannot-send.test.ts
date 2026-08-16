/**
 * A block must stop sending into an ALREADY-EXISTING conversation (#352).
 *
 * WHAT WAS WRONG. Creating a conversation was gated on an accepted connection;
 * sending into one was gated on participation and nothing else. So the sequence
 * that matters — talk to someone, then block them — left the block inert: the
 * blocked user kept sending, and the rows kept arriving. Across all nine
 * `messages` policies the word 'blocked' appeared exactly nowhere; it existed
 * only in the `status` CHECK constraint and an admin count.
 *
 * WHY THIS TEST EXISTS SEPARATELY FROM THE CONFORMANCE SUITE. The conformance
 * cases (C30) drive the two PROVIDERS. This drives the DATABASE directly as each
 * user, because the RLS rule has a dependency the providers cannot see:
 *
 *   The block check is a subquery over `user_connections` inside the `messages`
 *   INSERT policy. Policy expressions are evaluated as the CALLING user, so RLS
 *   on `user_connections` applies to it. Its SELECT policy is currently
 *   `auth.uid() = requester_id OR auth.uid() = addressee_id`, and the sender is
 *   always one of the two — so the row is visible and the rule bites. Narrow that
 *   policy and `NOT EXISTS` finds nothing, evaluates true, and the block silently
 *   stops being enforced with no error anywhere. That is why the visibility is
 *   asserted below as its own case rather than assumed.
 *
 * The first test is a POSITIVE control. Without it, every "the insert was
 * refused" assertion below would also pass if the fixture were broken and the
 * user could never insert at all — the shape that has produced false green here
 * before (#723, #396).
 *
 * @module tests/rls/blocked-cannot-send.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAuthenticatedClient,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
} from '../fixtures/test-users';

const ALICE = {
  email: 'blocked-send-alice@scripthammer.test',
  password: 'BlockedSendAlice1!',
};
const BOB = {
  email: 'blocked-send-bob@scripthammer.test',
  password: 'BlockedSendBob1!',
};

const describeRls = hasRlsTestEnvironment() ? describe : describe.skip;
if (!hasRlsTestEnvironment()) {
  console.warn(`[blocked-cannot-send] skipped: ${RLS_SKIP_REASON}`);
}

describeRls(
  'a block stops sending into an existing conversation (#352)',
  () => {
    const svc = createServiceClient();

    let aliceId: string;
    let bobId: string;
    /** participant_1_id / participant_2_id, in the canonical (sorted) order. */
    let p1: string;
    let p2: string;
    let conversationId: string;

    let asAlice: Awaited<ReturnType<typeof createAuthenticatedClient>>;
    let asBob: Awaited<ReturnType<typeof createAuthenticatedClient>>;

    /**
     * Exactly one connection row, pointing the way the caller asks.
     *
     * `unique_connection` is UNIQUE (requester_id, addressee_id) and is NOT
     * symmetric — a real block is one row whose direction depends on who pressed
     * the button, not on the conversation's participant ordering. Both directions
     * are deleted first so a case can pin the one it means to exercise.
     */
    async function setConnection(
      requesterId: string,
      addresseeId: string,
      status: 'accepted' | 'blocked'
    ): Promise<void> {
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
      // A fixture that failed to build the state under test makes every assertion
      // below meaningless, so it fails loudly rather than passing quietly.
      expect(error, `could not set connection to ${status}`).toBeNull();
    }

    async function messageCount(): Promise<number> {
      const { count, error } = await svc
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);
      expect(error).toBeNull();
      return count ?? 0;
    }

    /** Next free sequence number — the column is unique per conversation. */
    async function nextSeq(): Promise<number> {
      const { data } = await svc
        .from('messages')
        .select('sequence_number')
        .eq('conversation_id', conversationId)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.sequence_number ?? 0) + 1;
    }

    /** Attempt an INSERT as the given user; returns the PostgREST error code. */
    async function trySend(
      client: Awaited<ReturnType<typeof createAuthenticatedClient>>,
      senderId: string
    ): Promise<{ code?: string; inserted: boolean }> {
      const { data, error } = await client
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          encrypted_content: 'Y2lwaGVy',
          initialization_vector: 'aXY=',
          sequence_number: await nextSeq(),
          key_version: 1,
          deleted: false,
          edited: false,
        })
        .select()
        .maybeSingle();

      return { code: error?.code, inserted: Boolean(data) };
    }

    beforeAll(async () => {
      const alice = await createTestUser(ALICE.email, ALICE.password);
      const bob = await createTestUser(BOB.email, BOB.password);
      aliceId = alice.id;
      bobId = bob.id;

      // `canonical_ordering` requires participant_1_id < participant_2_id.
      [p1, p2] = aliceId < bobId ? [aliceId, bobId] : [bobId, aliceId];

      await setConnection(p1, p2, 'accepted');

      const { data: conv, error: convErr } = await svc
        .from('conversations')
        .insert({ participant_1_id: p1, participant_2_id: p2, is_group: false })
        .select('id')
        .single();
      expect(convErr).toBeNull();
      conversationId = conv!.id;

      asAlice = await createAuthenticatedClient(ALICE.email, ALICE.password);
      asBob = await createAuthenticatedClient(BOB.email, BOB.password);
    }, 60_000);

    afterAll(async () => {
      if (conversationId) {
        await svc
          .from('messages')
          .delete()
          .eq('conversation_id', conversationId);
        await svc.from('conversations').delete().eq('id', conversationId);
      }
      for (const id of [aliceId, bobId].filter(Boolean)) {
        await svc.from('user_connections').delete().eq('requester_id', id);
        await svc.from('user_connections').delete().eq('addressee_id', id);
        await deleteTestUser(id);
      }
    }, 60_000);

    it('POSITIVE CONTROL: with an accepted connection, both sides can send', async () => {
      // If this fails, nothing below means anything — every refusal assertion
      // would also hold for a user who simply cannot reach the table.
      await setConnection(p1, p2, 'accepted');

      const a = await trySend(asAlice, aliceId);
      expect(a.code, 'alice could not send even unblocked').toBeUndefined();
      expect(a.inserted).toBe(true);

      const b = await trySend(asBob, bobId);
      expect(b.code, 'bob could not send even unblocked').toBeUndefined();
      expect(b.inserted).toBe(true);
    });

    it('the blocked user cannot send — block stored (participant_1 → participant_2)', async () => {
      await setConnection(p1, p2, 'blocked');
      const sender = p2 === aliceId ? asAlice : asBob;
      const senderId = p2;

      const before = await messageCount();
      const result = await trySend(sender, senderId);

      expect(result.inserted).toBe(false);
      expect(result.code, 'expected an RLS refusal (42501)').toBe('42501');
      expect(await messageCount()).toBe(before);
    });

    it('the blocked user cannot send — block stored (participant_2 → participant_1)', async () => {
      // THE CASE THAT CATCHES A ONE-SIDED RULE. A check written against only
      // (participant_1 = requester_id AND participant_2 = addressee_id) passes the
      // test above and fails here — enforcing roughly half of real blocks, with no
      // error to say so. Both orderings are in the policy for this reason.
      await setConnection(p2, p1, 'blocked');
      const sender = p2 === aliceId ? asAlice : asBob;
      const senderId = p2;

      const before = await messageCount();
      const result = await trySend(sender, senderId);

      expect(result.inserted).toBe(false);
      expect(result.code, 'expected an RLS refusal (42501)').toBe('42501');
      expect(await messageCount()).toBe(before);
    });

    it('the blocker cannot send either, so the two directions look alike', async () => {
      // Symmetry is not courtesy. If the blocker could still send while the blocked
      // user could not, that difference IS the disclosure — anyone able to compare
      // the two directions learns the block exists.
      await setConnection(p1, p2, 'blocked');
      const sender = p1 === aliceId ? asAlice : asBob;

      const before = await messageCount();
      const result = await trySend(sender, p1);

      expect(result.inserted).toBe(false);
      expect(result.code).toBe('42501');
      expect(await messageCount()).toBe(before);
    });

    it('history stays readable to both sides while blocked', async () => {
      await setConnection(p1, p2, 'accepted');
      await trySend(asAlice, aliceId);
      await setConnection(p1, p2, 'blocked');

      const seen = await Promise.all(
        [asAlice, asBob].map(async (client) => {
          const { data, error } = await client
            .from('messages')
            .select('id')
            .eq('conversation_id', conversationId);
          expect(error).toBeNull();
          return data?.length ?? 0;
        })
      );

      expect(seen[0]).toBeGreaterThan(0);
      expect(seen[1]).toBe(seen[0]);
    });

    it('the sender can SEE the block row — the rule depends on it', async () => {
      // The policy's NOT EXISTS runs as the sender, so `user_connections` RLS
      // applies to it. Today's SELECT policy is
      // `auth.uid() = requester_id OR auth.uid() = addressee_id`, which covers both
      // participants. If that ever narrows, the subquery returns no rows, NOT
      // EXISTS evaluates true, and sending silently reopens — no error, no failing
      // insert, nothing to notice. This is the assertion that would go red first.
      await setConnection(p1, p2, 'blocked');

      for (const [label, client, id] of [
        ['alice', asAlice, aliceId],
        ['bob', asBob, bobId],
      ] as const) {
        const { data, error } = await client
          .from('user_connections')
          .select('status')
          .or(`requester_id.eq.${id},addressee_id.eq.${id}`);

        expect(error, `${label} could not read user_connections`).toBeNull();
        expect(
          data?.some((row) => row.status === 'blocked'),
          `${label} cannot see the block row, so the INSERT policy's subquery ` +
            'would find nothing and stop enforcing the block'
        ).toBe(true);
      }
    });
  }
);
