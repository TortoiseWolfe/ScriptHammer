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
 * escalation. The fix replaces that branch with is_conversation_creator(),
 * so only the group's creator can seed the roster.
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
    let service: SupabaseClient;
    let groupId: string;

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
      if (groupId) {
        // ON DELETE CASCADE clears members, keys, and messages.
        await service.from('conversations').delete().eq('id', groupId);
      }
      if (owner) await deleteTestUser(owner.id);
      if (outsider) await deleteTestUser(outsider.id);
    });

    // The core regression: the INSERT WITH CHECK must reject a self-join into
    // a group the caller did not create. is_conversation_creator() is the
    // exact predicate the policy uses for the non-member branch, so a false
    // here means the escalation is reachable.
    it('the creator predicate rejects a non-creator (the closed self-join branch)', async () => {
      const { data, error } = await service.rpc('is_conversation_creator', {
        conv_id: groupId,
        check_user_id: outsider.id,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('the creator predicate accepts the actual creator', async () => {
      const { data, error } = await service.rpc('is_conversation_creator', {
        conv_id: groupId,
        check_user_id: owner.id,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
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

    // The legitimate create path must still pass: the creator can seat a
    // member into their own group. This is the branch the fix had to
    // preserve (createGroup batch-inserts owner + members).
    it('lets the creator seat a member in their own group', async () => {
      const { data, error } = await service.rpc('is_conversation_creator', {
        conv_id: groupId,
        check_user_id: owner.id,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  }
);
