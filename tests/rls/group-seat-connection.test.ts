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
 * WHY THE ORDER OF THIS TEST IS LOAD-BEARING. The shipped client was safe only
 * INCIDENTALLY: `createGroup` seats the entire roster in ONE multi-row INSERT,
 * and a STABLE SECURITY DEFINER helper cannot see rows the same statement is
 * inserting. So a test that attempts the stranger BEFORE the actor is a member
 * passes against the vulnerable policy too — it only proves the pre-membership
 * window, which was never the hole. This test therefore seats the owner row
 * FIRST and attempts the stranger SECOND, which is the state an attacker
 * actually occupies. Reordering these two inserts silently destroys the
 * coverage.
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
  }
);
