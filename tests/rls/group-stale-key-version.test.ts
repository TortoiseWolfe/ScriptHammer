/**
 * RLS: a group message under a stale key version is refused (#1301, #1247 B3).
 *
 * #1247 B2 made key rotation land: removing a member moves `conversations.current_key_version`
 * forward. Nothing checked what a sender stamped on a message, so a tab running a bundle from
 * before B2 (which falls back to v1) or a message queued before a rotation was stored under an
 * old version, readable by every removed member who still holds that key.
 * `group_message_key_version_guard` makes the server refuse it.
 *
 * An edit is the same door: a sender may rewrite the ciphertext for 15 minutes, so the guard fires
 * on UPDATE OF encrypted_content, initialization_vector and key_version too, and lets an update
 * through when none of them changed (mark-read on an old message must keep working).
 *
 * Every refusal asserts its own phrase, because a refusal that could come from a different rule
 * proves nothing about this one. The CONTROLS (current version accepted, system message at v1
 * accepted, service role exempt) are what show the guard is a version check and not a blanket
 * refusal.
 *
 * @module tests/rls/group-stale-key-version.test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceClient,
  createAuthenticatedClient,
  createTestUser,
  deleteConversations,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

const STALE = /stale group key version/;

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: group messages need the current key version (#1301) [${RLS_SKIP_REASON}]`,
  () => {
    let a: TestUser; // owner
    let b: TestUser; // member
    let bClient: SupabaseClient;
    let service: SupabaseClient;
    const groups: string[] = [];

    /** A group with owner a and member b, at `version`. Seeded by the service role. */
    async function group(name: string, version: number): Promise<string> {
      const { data, error } = await service
        .from('conversations')
        .insert({
          is_group: true,
          group_name: `#1301 ${name}`,
          created_by: a.id,
          current_key_version: version,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`seed group: ${error?.message}`);
      const id = data.id as string;
      groups.push(id);
      for (const [u, role] of [
        [a, 'owner'],
        [b, 'member'],
      ] as const) {
        const { error: e } = await service.from('conversation_members').insert({
          conversation_id: id,
          user_id: u.id,
          role,
          key_version_joined: 1,
          key_status: 'active',
        });
        if (e) throw new Error(`seat: ${e.message}`);
      }
      return id;
    }

    const message = (
      conversation: string,
      sender: TestUser,
      keyVersion: number,
      extra: Record<string, unknown> = {}
    ) => ({
      conversation_id: conversation,
      sender_id: sender.id,
      encrypted_content: `ct-v${keyVersion}`,
      initialization_vector: 'iv',
      key_version: keyVersion,
      // Overwritten by the assign_sequence_number trigger; the column is NOT NULL.
      sequence_number: 0,
      ...extra,
    });

    async function stored(conv: string): Promise<number[]> {
      const { data, error } = await service
        .from('messages')
        .select('key_version')
        .eq('conversation_id', conv);
      if (error) throw new Error(`read messages: ${error.message}`);
      return (data ?? []).map((r) => r.key_version as number).sort();
    }

    beforeAll(async () => {
      service = createServiceClient() as unknown as SupabaseClient;
      a = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      b = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      bClient = (await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      )) as unknown as SupabaseClient;
    });

    afterAll(async () => {
      await deleteConversations(service, groups);
    });

    it('refuses a member’s message at a version the group has rotated past, and stores nothing', async () => {
      const g = await group('stale', 2);

      const { error } = await bClient.from('messages').insert(message(g, b, 1));

      expect(error?.code).toBe('42501');
      expect(error?.message).toMatch(STALE);
      expect(await stored(g)).toEqual([]);
    });

    it('CONTROL: the same member’s message at the current version is accepted', async () => {
      const g = await group('current', 2);

      const { error } = await bClient.from('messages').insert(message(g, b, 2));

      expect(error).toBeNull();
      expect(await stored(g)).toEqual([2]);
    });

    it('refuses a version the group has not reached either', async () => {
      const g = await group('future', 2);

      const { error } = await bClient.from('messages').insert(message(g, b, 3));

      expect(error?.code).toBe('42501');
      expect(error?.message).toMatch(STALE);
    });

    it('follows the rotation: v1 is accepted at v1, then refused once the group moves to v2', async () => {
      const g = await group('rotates', 1);
      const before = await bClient.from('messages').insert(message(g, b, 1));
      expect(before.error).toBeNull();

      const { error: bump } = await service
        .from('conversations')
        .update({ current_key_version: 2 })
        .eq('id', g);
      expect(bump).toBeNull();

      const after = await bClient.from('messages').insert(message(g, b, 1));
      expect(after.error?.message).toMatch(STALE);
      expect(await stored(g)).toEqual([1]); // only the one sent before the rotation
    });

    it('CONTROL: a system message at the default version is accepted (member_removed is written after the rotation)', async () => {
      const g = await group('system', 2);

      const { error } = await bClient.from('messages').insert(
        message(g, b, 1, {
          is_system_message: true,
          system_message_type: 'member_removed',
          encrypted_content: '{"type":"member_removed"}',
          initialization_vector: 'system',
        })
      );

      expect(error).toBeNull();
      expect(await stored(g)).toEqual([1]);
    });

    /** A message b sent at v1, before the group rotated to v2 (seeded by the service role). */
    async function oldMessageFromB(): Promise<string> {
      const g = await group('edits', 1);
      const { data, error } = await service
        .from('messages')
        .insert(message(g, b, 1))
        .select('id')
        .single();
      if (error || !data) throw new Error(`seed message: ${error?.message}`);
      const { error: bump } = await service
        .from('conversations')
        .update({ current_key_version: 2 })
        .eq('id', g);
      if (bump) throw new Error(`rotate: ${bump.message}`);
      editGroup = g;
      return data.id as string;
    }
    let editGroup = '';

    it('refuses an edit that rewrites the ciphertext but keeps the stale version', async () => {
      const id = await oldMessageFromB();

      const { error } = await bClient
        .from('messages')
        .update({ encrypted_content: 'edited-under-v1' })
        .eq('id', id);

      expect(error?.code).toBe('42501');
      expect(error?.message).toMatch(STALE);
    });

    it('CONTROL: an edit re-keyed at the current version is accepted', async () => {
      const id = await oldMessageFromB();

      const { error } = await bClient
        .from('messages')
        .update({ encrypted_content: 'edited-under-v2', key_version: 2 })
        .eq('id', id);

      expect(error).toBeNull();
      expect(await stored(editGroup)).toEqual([2]);
    });

    it('CONTROL: marking an old-version message read is not blocked', async () => {
      const id = await oldMessageFromB();
      const aClient = (await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      )) as unknown as SupabaseClient;

      const { error } = await aClient
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

      expect(error).toBeNull();
      expect(await stored(editGroup)).toEqual([1]);
    });

    it('CONTROL: the service role is exempt', async () => {
      const g = await group('service', 2);

      const { error } = await service.from('messages').insert(message(g, a, 1));

      expect(error).toBeNull();
      expect(await stored(g)).toEqual([1]);
    });
  }
);
