/**
 * RLS: a group creator may seat only people they are connected to (#1059).
 *
 * THE BUG THIS PINS. The `conversation_members` INSERT policy had two
 * INDEPENDENT branches — `is_conversation_member(...) OR
 * is_conversation_creator(...)` — and a creator could walk from one into the
 * other. Confirmed by executing it against production before the fix, in a
 * rolled-back transaction:
 *
 *   1. create a group                -> legitimate, the caller is created_by
 *   2. seat MYSELF as owner          -> allowed by is_conversation_creator
 *   3. seat ANYONE AT ALL            -> step 2 made is_conversation_member true,
 *                                       so branch 1 authorises it and the
 *                                       connection is never consulted
 *
 * The connection requirement — the product's whole consent mechanism for
 * messaging — lived only in `group-service.ts`. Three ordinary PostgREST calls
 * walked around it.
 *
 * WHY THE ORDER OF THIS TEST IS DELIBERATE. The shipped client was safe only
 * INCIDENTALLY: `createGroup` seats the entire roster in ONE multi-row INSERT,
 * and a STABLE SECURITY DEFINER helper cannot see rows the same statement is
 * inserting. So this test seats the owner row FIRST and attempts the stranger
 * SECOND, which is the state an attacker actually occupies.
 *
 * CORRECTION (2026-09-03): an earlier version of this comment claimed a
 * stranger-first ordering "passes against the vulnerable policy too" and that
 * reordering "silently destroys the coverage". That is FALSE for this file's
 * own fixture — `seedGroup` sets `created_by: creator.id`, so
 * `is_conversation_creator` alone satisfied the old policy and a stranger-first
 * insert would have been discriminating as well. The ordering is the more
 * faithful attacker model and is strictly no weaker, which is reason enough to
 * keep it; it is not the load-bearing thing the comment asserted.
 *
 * WHAT THIS FILE DOES AND DOES NOT PROVE. The cases below prove the INSERT path
 * consults an accepted connection. Two further routes reached the same outcome
 * and are pinned at the bottom of this file: rewriting an existing row via
 * UPDATE, and forging the connection the rule trusts. Without those two, a
 * green run here would assert a consent guarantee the system did not have.
 *
 * These run against a live Supabase instance (real Postgres RLS) and skip —
 * visibly — when the service-role key and URL are absent.
 *
 * @module tests/rls/group-seat-connection.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createServiceClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';
import type { SupabaseClient } from '@supabase/supabase-js';

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: group seating requires a connection (#1059) [${RLS_SKIP_REASON}]`,
  () => {
    let creator: TestUser;
    let stranger: TestUser;
    let creatorClient: SupabaseClient;
    let service: SupabaseClient;
    const groupIds: string[] = [];

    /** A fresh group owned by `creator`, seeded past RLS so each case starts clean. */
    async function seedGroup(name: string): Promise<string> {
      const { data, error } = await service
        .from('conversations')
        .insert({
          is_group: true,
          group_name: name,
          created_by: creator.id,
          current_key_version: 1,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`seed failed: ${error?.message}`);
      groupIds.push(data.id);
      return data.id;
    }

    /** Remove any connection between the two users, in both directions. */
    async function clearConnection() {
      await service
        .from('user_connections')
        .delete()
        .or(
          `and(requester_id.eq.${creator.id},addressee_id.eq.${stranger.id}),` +
            `and(requester_id.eq.${stranger.id},addressee_id.eq.${creator.id})`
        );
    }

    beforeAll(async () => {
      service = createServiceClient();
      creator = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      stranger = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      creatorClient = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      await clearConnection();
    });

    afterAll(async () => {
      for (const id of groupIds) {
        // ON DELETE CASCADE clears members and keys.
        await service.from('conversations').delete().eq('id', id);
      }
      await clearConnection();
      if (creator) await deleteTestUser(creator.id);
      if (stranger) await deleteTestUser(stranger.id);
    });

    it('lets the creator seat their own owner row', async () => {
      // The positive control for step 2. If this ever fails, groups become
      // uncreatable and every refusal below is meaningless.
      const groupId = await seedGroup('own owner row');
      const { error } = await creatorClient
        .from('conversation_members')
        .insert({
          conversation_id: groupId,
          user_id: creator.id,
          role: 'owner',
          key_version_joined: 1,
        });
      expect(error).toBeNull();
    });

    it('refuses an unconnected user AFTER the creator is already a member', async () => {
      // THE REGRESSION. Owner row first, stranger second — the attacker's real
      // state. Against the old policy the second insert SUCCEEDED, because
      // being a member satisfied branch 1 on its own.
      const groupId = await seedGroup('bypass attempt');

      const seatSelf = await creatorClient.from('conversation_members').insert({
        conversation_id: groupId,
        user_id: creator.id,
        role: 'owner',
        key_version_joined: 1,
      });
      expect(seatSelf.error).toBeNull();

      const seatStranger = await creatorClient
        .from('conversation_members')
        .insert({
          conversation_id: groupId,
          user_id: stranger.id,
          role: 'member',
          key_version_joined: 1,
        });

      // Pin the refusal by CODE, not by row state: a withheld column and a
      // policy denial both surface as 403 over PostgREST, and asserting only
      // "no row appeared" cannot tell a refusal from a silently broken insert.
      expect(seatStranger.error).not.toBeNull();
      expect(seatStranger.error?.code).toBe('42501');

      // And the row really is absent, read past RLS.
      const { data } = await service
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', groupId)
        .eq('user_id', stranger.id);
      expect(data ?? []).toHaveLength(0);
    });

    it('allows a connected user to be seated — either connection direction', async () => {
      // The rule is "an accepted connection with the actor", not "the actor
      // sent the request". `unique_connection` is (requester_id, addressee_id)
      // and is NOT symmetric, so both orderings have to be exercised or half
      // the product breaks.
      for (const [requester, addressee, label] of [
        [creator.id, stranger.id, 'creator requested'],
        [stranger.id, creator.id, 'stranger requested'],
      ] as const) {
        await clearConnection();
        const conn = await service.from('user_connections').insert({
          requester_id: requester,
          addressee_id: addressee,
          status: 'accepted',
        });
        expect(conn.error, `seeding ${label}`).toBeNull();

        const groupId = await seedGroup(`connected: ${label}`);
        await creatorClient.from('conversation_members').insert({
          conversation_id: groupId,
          user_id: creator.id,
          role: 'owner',
          key_version_joined: 1,
        });

        const { error } = await creatorClient
          .from('conversation_members')
          .insert({
            conversation_id: groupId,
            user_id: stranger.id,
            role: 'member',
            key_version_joined: 1,
          });
        expect(error, `${label} should permit seating`).toBeNull();
      }
      await clearConnection();
    });

    it('still refuses a non-creator seating themselves (#34 has not regressed)', async () => {
      // The older escalation, re-asserted here because #1059 rewrote the same
      // policy and could have widened it.
      const groupId = await seedGroup('outsider self-insert');
      await creatorClient.from('conversation_members').insert({
        conversation_id: groupId,
        user_id: creator.id,
        role: 'owner',
        key_version_joined: 1,
      });

      const strangerClient = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      const { error } = await strangerClient
        .from('conversation_members')
        .insert({
          conversation_id: groupId,
          user_id: stranger.id,
          role: 'member',
          key_version_joined: 1,
        });
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('refuses rewriting an existing member row onto another user or group', async () => {
      // RESIDUAL BYPASS A. RLS gates ROWS; the seat rule above is a row rule and
      // says nothing about which COLUMNS of an existing row may change. The
      // UPDATE policy declares no WITH CHECK, so Postgres reuses its USING
      // expression, which `is_conversation_owner` satisfies from the
      // pre-statement snapshot. Holding UPDATE on every column, an owner could
      // move their own row into another group they own and rewrite `user_id`.
      // Demonstrated against a local stack before the fix; the fix is a column
      // grant, so this is refused before any policy is consulted.
      const groupA = await seedGroup('patch source');
      const groupB = await seedGroup('patch target');

      for (const id of [groupA, groupB]) {
        const seat = await creatorClient.from('conversation_members').insert({
          conversation_id: id,
          user_id: creator.id,
          role: 'owner',
          key_version_joined: 1,
        });
        expect(seat.error, 'owner seating is the positive control').toBeNull();
      }

      const { error } = await creatorClient
        .from('conversation_members')
        .update({ conversation_id: groupB, user_id: stranger.id })
        .eq('conversation_id', groupA)
        .eq('user_id', creator.id);

      expect(
        error,
        'rewriting user_id/conversation_id must be refused'
      ).not.toBeNull();
      expect(error?.code).toBe('42501');

      // The row state, not just the error — a refusal that still wrote would be
      // the worst possible pass.
      const { data: seated } = await service
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', groupB)
        .eq('user_id', stranger.id);
      expect(seated ?? []).toHaveLength(0);
    });

    it('still lets a member leave, which is the UPDATE that must survive', async () => {
      // The counterweight to the case above. DELETE is `USING (false)`, so
      // leaving a group is an UPDATE of `left_at`. If the column grant were
      // drawn one column too tight, members would be trapped with no exit and
      // nothing else in the suite would say so.
      const groupId = await seedGroup('leaving still works');
      await creatorClient.from('conversation_members').insert({
        conversation_id: groupId,
        user_id: creator.id,
        role: 'owner',
        key_version_joined: 1,
      });

      const { error } = await creatorClient
        .from('conversation_members')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', groupId)
        .eq('user_id', creator.id);

      expect(error, 'leaving a group must remain possible').toBeNull();
    });

    it('refuses a self-issued ACCEPTED connection, and still permits a request', async () => {
      // RESIDUAL BYPASS B. The seat rule trusts an accepted `user_connections`
      // row. The INSERT policy constrained only `requester_id`, so a user could
      // grant themselves the consent the rule reads — defeating not just this
      // rule but conversation creation and the block rule, all of which treat an
      // accepted row as proof that two people agreed.
      await clearConnection();

      const forged = await creatorClient.from('user_connections').insert({
        requester_id: creator.id,
        addressee_id: stranger.id,
        status: 'accepted',
      });
      expect(
        forged.error,
        'self-issued acceptance must be refused'
      ).not.toBeNull();
      expect(forged.error?.code).toBe('42501');

      // Positive control: asking is still allowed. Without this, a policy that
      // refused every insert would pass the assertion above.
      const asked = await creatorClient.from('user_connections').insert({
        requester_id: creator.id,
        addressee_id: stranger.id,
        status: 'pending',
      });
      expect(
        asked.error,
        'sending a friend request must still work'
      ).toBeNull();

      await clearConnection();
    });

    it('refuses an addressee rewriting who a connection is with', async () => {
      // RESIDUAL BYPASS B, SECOND ROUTE. Pinning `status` on INSERT was not
      // enough. "Addressee can update connection status" checks only that the
      // addressee is still you — it pins neither `requester_id` nor `status`.
      // So the addressee of ANY row could rewrite `requester_id` to a victim and
      // set `status` to 'accepted', regenerating the consent record the INSERT
      // rule had just been taught to demand. Owning such a row costs one
      // throwaway account sending you an ordinary friend request.
      //
      // Closed with a column grant: `status` is the only column any legitimate
      // flow writes, so the identities in a connection row are immutable once
      // written.
      await clearConnection();

      // The stranger sends the creator an ordinary friend request. Legitimate.
      const strangerClient = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      const asked = await strangerClient.from('user_connections').insert({
        requester_id: stranger.id,
        addressee_id: creator.id,
        status: 'pending',
      });
      expect(
        asked.error,
        'sending a request is the positive control'
      ).toBeNull();

      // The creator is now the addressee. Try to rewrite who it is with.
      const rewritten = await creatorClient
        .from('user_connections')
        .update({ requester_id: creator.id })
        .eq('addressee_id', creator.id)
        .eq('requester_id', stranger.id);
      expect(
        rewritten.error,
        'rewriting requester_id must be refused'
      ).not.toBeNull();
      expect(rewritten.error?.code).toBe('42501');

      // The counterweight: responding to the request must still work, or the
      // whole friend-request flow is dead and no other test would say so.
      const accepted = await creatorClient
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('addressee_id', creator.id)
        .eq('requester_id', stranger.id);
      expect(accepted.error, 'accepting a request must still work').toBeNull();

      await clearConnection();
    });
  }
);
