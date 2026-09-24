/**
 * RLS Group Isolation Tests
 *
 * Security coverage for group-conversation membership. The group messaging
 * tables (conversation_members, group_keys, messages) gate every read
 * through the is_conversation_member() SECURITY DEFINER helper, so a single
 * bogus membership row is the master key to a group's roster, encrypted
 * keys, and message history.
 *
 * Regression pinned here (#34): the conversation_members INSERT policy once
 * carried an `OR user_id = auth.uid()` self-join branch that let ANY
 * authenticated user insert a membership row into ANY group — a privilege
 * escalation. The fix scoped that branch to the group's creator; #1247 B1 narrowed it to a
 * founder whose group nobody has been seated in yet, and B2 retired the old
 * is_conversation_creator() helper. The cases below insert for real rather than asking a helper.
 *
 * These run against a live Supabase instance (real Postgres RLS) and skip —
 * visibly — when the service-role key and URL are absent, so CI shows the
 * coverage is deferred, not missing.
 *
 * Note on method: the escalation lives at the database WITH CHECK layer, and
 * the exact threat is a client that reaches Postgres with a valid token,
 * bypassing the TypeScript service layer. The most faithful reproduction
 * evaluates the policy predicate under a simulated authenticated JWT (what
 * these tests do via seeded state + the SECURITY DEFINER helpers), rather
 * than relying on quirks of how one HTTP client serializes an insert.
 *
 * @module tests/rls/group-isolation.test
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
  `RLS: Group Conversation Isolation (#34) [${RLS_SKIP_REASON}]`,
  () => {
    let owner: TestUser; // creates the group
    let outsider: TestUser; // never a member — the attacker
    let outsiderClient: SupabaseClient;
    let ownerClient: SupabaseClient;
    let service: SupabaseClient;
    let groupId: string;
    const extraGroups: string[] = [];

    /** A group the owner created and nobody has been seated in yet. */
    async function unseatedGroup(name: string): Promise<string> {
      const { data, error } = await service
        .from('conversations')
        .insert({
          is_group: true,
          group_name: name,
          created_by: owner.id,
          current_key_version: 1,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`seed group: ${error?.message}`);
      extraGroups.push(data.id as string);
      return data.id as string;
    }

    beforeAll(async () => {
      service = createServiceClient();
      owner = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      outsider = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      outsiderClient = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      ownerClient = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );

      // Seed a group with the owner as sole member and one encrypted key,
      // via the service client (bypasses RLS) so the assertions exercise
      // policy, not the create path.
      const { data: conv, error: convError } = await service
        .from('conversations')
        .insert({
          is_group: true,
          group_name: 'RLS isolation fixture',
          created_by: owner.id,
          current_key_version: 1,
        })
        .select('id')
        .single();
      if (convError || !conv) {
        throw new Error(`Failed to seed group: ${convError?.message}`);
      }
      groupId = conv.id;

      await service.from('conversation_members').insert({
        conversation_id: groupId,
        user_id: owner.id,
        role: 'owner',
        key_version_joined: 1,
        key_status: 'active',
      });
      await service.from('group_keys').insert({
        conversation_id: groupId,
        user_id: owner.id,
        key_version: 1,
        encrypted_key: 'fixture-encrypted-key',
      });
    });

    afterAll(async () => {
      for (const id of [groupId, ...extraGroups].filter(Boolean)) {
        // ON DELETE CASCADE clears members, keys, and messages.
        await service.from('conversations').delete().eq('id', id);
      }
      await service
        .from('user_connections')
        .delete()
        .or(
          `and(requester_id.eq.${owner.id},addressee_id.eq.${outsider.id}),and(requester_id.eq.${outsider.id},addressee_id.eq.${owner.id})`
        );
      if (owner) await deleteTestUser(owner.id);
      if (outsider) await deleteTestUser(outsider.id);
    });

    // The core regression: the INSERT WITH CHECK must reject a self-join into
    // a group the caller did not create — as owner or as member.
    it('an outsider cannot seat themselves in a group they did not create (the closed self-join branch)', async () => {
      for (const role of ['owner', 'member'] as const) {
        const { error } = await outsiderClient
          .from('conversation_members')
          .insert({
            conversation_id: groupId,
            user_id: outsider.id,
            role,
            key_version_joined: 1,
            key_status: 'active',
          });
        expect(error?.code, `self-seat as ${role}`).toBe('42501');
      }
      const { data } = await service
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', groupId)
        .eq('user_id', outsider.id);
      expect(data ?? []).toHaveLength(0);
    });

    it('CONTROL: the founder seats themselves as owner while nobody is seated', async () => {
      const g = await unseatedGroup('RLS isolation: founder seat');
      const { error } = await ownerClient.from('conversation_members').insert({
        conversation_id: g,
        user_id: owner.id,
        role: 'owner',
        key_version_joined: 1,
        key_status: 'active',
      });
      expect(error).toBeNull();
    });

    // Impact assertions: even if some insert path existed, an outsider must
    // never READ the roster or the encrypted keys. These ride the
    // is_conversation_member() SELECT gate.
    it('keeps an outsider out of the group roster', async () => {
      const { data } = await outsiderClient
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', groupId);
      expect(data ?? []).toHaveLength(0);
    });

    it('does not leak the group encryption key to an outsider', async () => {
      const { data } = await outsiderClient
        .from('group_keys')
        .select('encrypted_key')
        .eq('conversation_id', groupId);
      expect(data ?? []).toHaveLength(0);
    });

    // The legitimate create path must still pass: the creator seats themselves and a
    // connection in one statement, exactly as createGroup does.
    it('lets the creator seat a member in their own group', async () => {
      const { error: connectError } = await service
        .from('user_connections')
        .insert({
          requester_id: owner.id,
          addressee_id: outsider.id,
          status: 'accepted',
        });
      expect(connectError).toBeNull();
      const g = await unseatedGroup('RLS isolation: founder seats a member');
      const { data, error } = await ownerClient
        .from('conversation_members')
        .insert([
          {
            conversation_id: g,
            user_id: owner.id,
            role: 'owner',
            key_version_joined: 1,
            key_status: 'active',
          },
          {
            conversation_id: g,
            user_id: outsider.id,
            role: 'member',
            key_version_joined: 1,
            key_status: 'active',
          },
        ])
        .select('id');
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(2);
    });
  }
);
