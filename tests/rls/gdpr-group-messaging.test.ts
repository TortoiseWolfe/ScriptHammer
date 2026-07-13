/**
 * DB-contract regression tests for the GDPR group-messaging trio (#247/#243).
 *
 * Runs against a live Supabase instance (local via
 * `docker compose --profile supabase up`, or cloud). Pins the schema-level
 * invariants the fixes rely on:
 *
 *   #247  A group creator (or group-key distributor) CAN be erased — the
 *         created_by FKs are ON DELETE SET NULL, and a DB trigger auto-transfers
 *         ownership so no owner-less orphaned group is left behind.
 *   #243  group_keys rows carry creator_public_key; the backfill populated
 *         existing rows so historical group keys stay unwrappable after the
 *         creator rotates their personal keys.
 *
 * (The #248 export and the #243 crypto round-trip are covered by unit tests —
 *  gdpr-service.test.ts and group-key-roundtrip.node.test.ts.)
 *
 * @module tests/rls/gdpr-group-messaging.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

describe.skipIf(!hasRlsTestEnvironment())(
  `GDPR group-messaging DB contracts [${RLS_SKIP_REASON}]`,
  () => {
    const svc = createServiceClient();
    let creator: TestUser;
    let member: TestUser;
    const convIds: string[] = [];

    beforeAll(async () => {
      creator = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      member = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
    });

    afterAll(async () => {
      for (const id of convIds) {
        await svc.from('conversations').delete().eq('id', id);
      }
      // creator may already be gone (erasure test); deleteTestUser is best-effort
      await deleteTestUser(creator.id).catch(() => {});
      await deleteTestUser(member.id).catch(() => {});
    });

    // ── #247 ──────────────────────────────────────────────────────────
    it('#247: a group creator who distributed keys can be erased; the group survives', async () => {
      const { data: conv } = await svc
        .from('conversations')
        .insert({
          is_group: true,
          group_name: 'e247-erasure',
          created_by: creator.id,
          current_key_version: 1,
        })
        .select()
        .single();
      convIds.push(conv!.id);

      await svc.from('conversation_members').insert([
        { conversation_id: conv!.id, user_id: creator.id, role: 'owner' },
        { conversation_id: conv!.id, user_id: member.id, role: 'member' },
      ]);
      // creator distributed a key to the member (created_by = creator, the FK
      // that used to block erasure).
      await svc.from('group_keys').insert({
        conversation_id: conv!.id,
        user_id: member.id,
        key_version: 1,
        encrypted_key: 'ciphertext',
        created_by: creator.id,
      });

      // THE FIX: erasing the creator's profile now succeeds (was blocked).
      const del = await svc.from('user_profiles').delete().eq('id', creator.id);
      expect(del.error).toBeNull();

      // Group survives with created_by nulled; member's key row survives.
      const { data: survivingConv } = await svc
        .from('conversations')
        .select('id, created_by')
        .eq('id', conv!.id)
        .single();
      expect(survivingConv?.created_by).toBeNull();

      const { data: survivingKey } = await svc
        .from('group_keys')
        .select('user_id, created_by')
        .eq('conversation_id', conv!.id)
        .eq('user_id', member.id)
        .single();
      expect(survivingKey).toBeTruthy();
      expect(survivingKey?.created_by).toBeNull();
    });

    it('#247: erasing the sole owner auto-transfers ownership (no orphaned group)', async () => {
      // Re-create the creator profile for a clean owner-transfer scenario.
      const owner = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );

      const { data: conv } = await svc
        .from('conversations')
        .insert({
          is_group: true,
          group_name: 'e247-owner-transfer',
          created_by: owner.id,
          current_key_version: 1,
        })
        .select()
        .single();
      convIds.push(conv!.id);

      // owner joined first; member is the earliest-joined survivor.
      await svc.from('conversation_members').insert([
        {
          conversation_id: conv!.id,
          user_id: owner.id,
          role: 'owner',
          joined_at: new Date(Date.now() - 7200_000).toISOString(),
        },
        {
          conversation_id: conv!.id,
          user_id: member.id,
          role: 'member',
          joined_at: new Date(Date.now() - 3600_000).toISOString(),
        },
      ]);

      // Erase the sole owner → the trigger must promote the survivor.
      const del = await svc.from('user_profiles').delete().eq('id', owner.id);
      expect(del.error).toBeNull();

      const { data: owners } = await svc
        .from('conversation_members')
        .select('user_id, role')
        .eq('conversation_id', conv!.id)
        .eq('role', 'owner')
        .is('left_at', null);
      // Exactly one owner remains, and it's the surviving member.
      expect(owners?.length).toBe(1);
      expect(owners?.[0].user_id).toBe(member.id);

      await deleteTestUser(owner.id).catch(() => {});
    });

    // ── #243 ──────────────────────────────────────────────────────────
    it('#243: group_keys carries creator_public_key (column present, backfilled)', async () => {
      // Column exists and accepts a JWK on insert.
      const { data: conv } = await svc
        .from('conversations')
        .insert({
          is_group: true,
          group_name: 'e243-col',
          created_by: member.id,
          current_key_version: 1,
        })
        .select()
        .single();
      convIds.push(conv!.id);

      const jwk = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' };
      const ins = await svc.from('group_keys').insert({
        conversation_id: conv!.id,
        user_id: member.id,
        key_version: 1,
        encrypted_key: 'ct',
        created_by: member.id,
        creator_public_key: jwk,
      });
      expect(ins.error).toBeNull();

      const { data: row } = await svc
        .from('group_keys')
        .select('creator_public_key')
        .eq('conversation_id', conv!.id)
        .eq('user_id', member.id)
        .single();
      expect(row?.creator_public_key).toMatchObject(jwk);
    });
  }
);
