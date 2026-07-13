/**
 * DB-contract regression tests for the messaging-reliability trio (#244/#245/#246).
 *
 * Runs against a live Supabase instance. Pins the schema invariants:
 *   #244  assign_sequence_number() is atomic per conversation (advisory lock) —
 *         N concurrent inserts get distinct, gap-free sequence numbers, 0
 *         unique_sequence collisions.
 *   #245  messages.client_generated_id + its unique index give exactly-once
 *         offline delivery — a replayed upsert is a no-op; NULL live sends
 *         coexist freely.
 *
 * @module tests/rls/messaging-reliability.test
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
  `Messaging-reliability DB contracts [${RLS_SKIP_REASON}]`,
  () => {
    const svc = createServiceClient();
    let user: TestUser;
    let convId: string;

    beforeAll(async () => {
      user = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      const { data: conv } = await svc
        .from('conversations')
        .insert({
          is_group: true,
          group_name: 'e-reliability',
          created_by: user.id,
          current_key_version: 1,
        })
        .select()
        .single();
      convId = conv!.id;
      await svc
        .from('conversation_members')
        .insert({ conversation_id: convId, user_id: user.id });
    });

    afterAll(async () => {
      await svc.from('conversations').delete().eq('id', convId);
      await deleteTestUser(user.id).catch(() => {});
    });

    // ── #244 ──────────────────────────────────────────────────────────
    it('#244: N concurrent inserts get distinct, gap-free sequence numbers', async () => {
      const N = 25;
      // Fire N inserts concurrently — each is its own request/transaction, so
      // they race the assign_sequence_number trigger the way real senders do.
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          svc.from('messages').insert({
            conversation_id: convId,
            sender_id: user.id,
            encrypted_content: `concurrent-${i}`,
            initialization_vector: 'iv',
            sequence_number: 0, // trigger overrides
          })
        )
      );

      // No insert should have failed with a unique_sequence collision (23505).
      const errored = results.filter((r) => r.error);
      expect(errored).toEqual([]);

      const { data: rows } = await svc
        .from('messages')
        .select('sequence_number')
        .eq('conversation_id', convId)
        .order('sequence_number', { ascending: true });
      const seqs = (rows || []).map((r) => r.sequence_number);
      // Exactly N rows, all distinct, contiguous 1..N (gap-free, no collision).
      expect(seqs.length).toBe(N);
      expect(new Set(seqs).size).toBe(N);
      expect(seqs[0]).toBe(1);
      expect(seqs[seqs.length - 1]).toBe(N);
    });

    // ── #245 ──────────────────────────────────────────────────────────
    it('#245: a replayed offline flush (same client_generated_id) yields one row', async () => {
      const cgid = crypto.randomUUID();
      const payload = {
        conversation_id: convId,
        sender_id: user.id,
        encrypted_content: 'offline-msg',
        initialization_vector: 'iv',
        sequence_number: 0,
        client_generated_id: cgid,
      };

      // First flush, then a replay — the exact reconnect-storm shape.
      const first = await svc.from('messages').upsert(payload, {
        onConflict: 'client_generated_id',
        ignoreDuplicates: true,
      });
      expect(first.error).toBeNull();
      const replay = await svc.from('messages').upsert(payload, {
        onConflict: 'client_generated_id',
        ignoreDuplicates: true,
      });
      expect(replay.error).toBeNull();

      const { count } = await svc
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('client_generated_id', cgid);
      expect(count).toBe(1);
    });

    it('#245: live sends with NULL client_generated_id are not deduped', async () => {
      const before = await svc
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convId)
        .is('client_generated_id', null);

      // Two live sends, both without a client id — both must persist.
      await svc.from('messages').insert([
        {
          conversation_id: convId,
          sender_id: user.id,
          encrypted_content: 'live-a',
          initialization_vector: 'iv',
          sequence_number: 0,
        },
        {
          conversation_id: convId,
          sender_id: user.id,
          encrypted_content: 'live-b',
          initialization_vector: 'iv',
          sequence_number: 0,
        },
      ]);

      const after = await svc
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convId)
        .is('client_generated_id', null);
      expect((after.count ?? 0) - (before.count ?? 0)).toBe(2);
    });
  }
);
