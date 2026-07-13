/**
 * DB-contract regression tests for the #281 message-UPDATE column guard.
 *
 * Runs against a live Supabase instance (local via
 * `docker compose --profile supabase up`, or cloud). Pins the invariant that the
 * `enforce_message_update_columns()` BEFORE UPDATE trigger enforces:
 *
 *   RLS gates ROWS, not COLUMNS, and the two permissive UPDATE policies on
 *   `messages` OR-combine, so a non-sender participant who satisfies the
 *   "Recipients can mark messages as read" policy could rewrite ANY column
 *   (ciphertext, IV, key_version, edited, deleted) — forging another user's
 *   message. Reproduced live with a raw anon client (#281). The trigger enforces
 *   the column contract RLS cannot express:
 *     - non-sender: may change ONLY read_at / delivered_at
 *     - sender: may also change content columns (15-min window still by RLS)
 *     - nobody: may change immutable id/conversation_id/sender_id/created_at/
 *       sequence_number/client_generated_id/is_system_message/system_message_type
 *     - service_role / no-JWT admin: exempt (bypass RLS, so bypass the guard)
 *
 * Each assertion checks BOTH the rejection AND the persisted value — an
 * error-only assertion would false-green a silent-discard bug.
 *
 * @module tests/rls/messages-update-guard.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAuthenticatedClient,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  type TestUser,
} from '../fixtures/test-users';
import type { SupabaseClient } from '@supabase/supabase-js';

const SENDER = {
  email: 'guard281-sender@scripthammer.test',
  password: 'Guard281Sender!',
};
const RECIPIENT = {
  email: 'guard281-recipient@scripthammer.test',
  password: 'Guard281Recip!',
};

describe.skipIf(!hasRlsTestEnvironment())(
  `#281 message-UPDATE column guard [${RLS_SKIP_REASON}]`,
  () => {
    const svc = createServiceClient();
    let sender: TestUser;
    let recipient: TestUser;
    let senderClient: SupabaseClient;
    let recipientClient: SupabaseClient;
    let conversationId: string;

    beforeAll(async () => {
      sender = await createTestUser(SENDER.email, SENDER.password);
      recipient = await createTestUser(RECIPIENT.email, RECIPIENT.password);

      // Canonical ordering + accepted connection + 1:1 conversation.
      const [p1, p2] =
        sender.id < recipient.id
          ? [sender.id, recipient.id]
          : [recipient.id, sender.id];
      await svc.from('user_connections').insert({
        requester_id: p1,
        addressee_id: p2,
        status: 'accepted',
      });
      const { data: conv } = await svc
        .from('conversations')
        .insert({
          participant_1_id: p1,
          participant_2_id: p2,
          is_group: false,
          current_key_version: 1,
        })
        .select()
        .single();
      conversationId = conv!.id;

      senderClient = await createAuthenticatedClient(
        SENDER.email,
        SENDER.password
      );
      recipientClient = await createAuthenticatedClient(
        RECIPIENT.email,
        RECIPIENT.password
      );
    }, 60_000);

    afterAll(async () => {
      await svc.from('conversations').delete().eq('id', conversationId);
      await svc
        .from('user_connections')
        .delete()
        .or(`requester_id.eq.${sender.id},requester_id.eq.${recipient.id}`);
      await deleteTestUser(sender.id).catch(() => {});
      await deleteTestUser(recipient.id).catch(() => {});
    });

    // Seed a fresh sender message via the service client, return its id.
    async function seed(content = 'ORIGINAL'): Promise<string> {
      const { data } = await svc
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: sender.id,
          encrypted_content: content,
          initialization_vector: 'iv',
          sequence_number: 0, // trigger overrides
          key_version: 1,
        })
        .select('id')
        .single();
      return data!.id;
    }
    async function read(id: string) {
      const { data } = await svc
        .from('messages')
        .select('*')
        .eq('id', id)
        .single();
      return data!;
    }

    // ── The exploit — every variant must be BLOCKED, row unchanged ──────────
    it('BLOCKS a recipient rewriting the sender ciphertext', async () => {
      const id = await seed('ORIGINAL_BY_SENDER');
      const { error } = await recipientClient
        .from('messages')
        .update({ encrypted_content: 'HIJACKED', edited: true })
        .eq('id', id);
      expect(error).not.toBeNull();
      const row = await read(id);
      expect(row.encrypted_content).toBe('ORIGINAL_BY_SENDER');
      expect(row.edited).toBe(false);
    });

    it('BLOCKS a recipient smuggling ciphertext alongside a legit read_at', async () => {
      const id = await seed('ORIG_SMUGGLE');
      await recipientClient
        .from('messages')
        .update({
          read_at: new Date().toISOString(),
          encrypted_content: 'SMUGGLED',
        })
        .eq('id', id);
      const row = await read(id);
      // The whole statement aborts — neither column is applied.
      expect(row.encrypted_content).toBe('ORIG_SMUGGLE');
      expect(row.read_at).toBeNull();
    });

    it('BLOCKS a recipient censoring via deleted=true', async () => {
      const id = await seed('CENSOR_ME');
      await recipientClient
        .from('messages')
        .update({ deleted: true })
        .eq('id', id);
      const row = await read(id);
      expect(row.deleted).toBe(false);
    });

    it('BLOCKS a recipient forging edited/edited_at', async () => {
      const id = await seed('FORGE_EDIT');
      await recipientClient
        .from('messages')
        .update({ edited: true, edited_at: new Date().toISOString() })
        .eq('id', id);
      const row = await read(id);
      expect(row.edited).toBe(false);
      expect(row.edited_at).toBeNull();
    });

    it('BLOCKS authorship theft (changing sender_id) — immutable column', async () => {
      const id = await seed('MINE_NOW');
      await recipientClient
        .from('messages')
        .update({ sender_id: recipient.id, encrypted_content: 'MINE' })
        .eq('id', id);
      const row = await read(id);
      expect(row.sender_id).toBe(sender.id);
      expect(row.encrypted_content).toBe('MINE_NOW');
    });

    it('BLOCKS the SENDER changing an immutable column (sequence_number)', async () => {
      const id = await seed('SEQ_TAMPER');
      await senderClient
        .from('messages')
        .update({ sequence_number: 1, encrypted_content: 'X' })
        .eq('id', id);
      const row = await read(id);
      expect(row.encrypted_content).toBe('SEQ_TAMPER');
    });

    // ── Legit flows — must all be ALLOWED ───────────────────────────────────
    it('ALLOWS a recipient markAsRead (read_at only)', async () => {
      const id = await seed();
      const { error } = await recipientClient
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null);
      expect(error).toBeNull();
      const row = await read(id);
      expect(row.read_at).not.toBeNull();
    });

    it('ALLOWS a recipient markAsDelivered (delivered_at only)', async () => {
      const id = await seed();
      const { error } = await recipientClient
        .from('messages')
        .update({ delivered_at: new Date().toISOString() })
        .eq('id', id)
        .is('delivered_at', null);
      expect(error).toBeNull();
      const row = await read(id);
      expect(row.delivered_at).not.toBeNull();
    });

    it('ALLOWS the sender editing content within the window', async () => {
      const id = await seed('BEFORE_EDIT');
      const { error } = await senderClient
        .from('messages')
        .update({
          encrypted_content: 'AFTER_EDIT',
          initialization_vector: 'iv2',
          key_version: 1,
          edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', id);
      expect(error).toBeNull();
      const row = await read(id);
      expect(row.encrypted_content).toBe('AFTER_EDIT');
      expect(row.edited).toBe(true);
    });

    it('ALLOWS the sender soft-deleting their own message', async () => {
      const id = await seed('DELETE_ME');
      const { error } = await senderClient
        .from('messages')
        .update({ deleted: true })
        .eq('id', id);
      expect(error).toBeNull();
      const row = await read(id);
      expect(row.deleted).toBe(true);
    });

    it('ALLOWS the sender self-marking read (benign)', async () => {
      const id = await seed();
      const { error } = await senderClient
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      expect(error).toBeNull();
      const row = await read(id);
      expect(row.read_at).not.toBeNull();
    });

    it('ALLOWS service_role to update any column (exempt admin path)', async () => {
      const id = await seed('SYS_BEFORE');
      const { error } = await svc
        .from('messages')
        .update({ encrypted_content: 'SYS_AFTER' })
        .eq('id', id);
      expect(error).toBeNull();
      const row = await read(id);
      expect(row.encrypted_content).toBe('SYS_AFTER');
    });
  }
);
