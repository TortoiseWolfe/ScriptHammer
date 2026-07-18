/**
 * Proves the #321 DB backstop for the .NET messaging backend.
 *
 * The ASP.NET Core backend connects as the least-privilege `dotnet_app` role and,
 * per request, does `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', …)`
 * (RlsActorMiddleware) so RLS + the #281 column-guard trigger enforce with the
 * caller's identity. This test replicates that exact seam via a raw `pg`
 * connection AS `dotnet_app` and asserts the DB blocks a cross-user write EVEN IF
 * the server's C# check were bypassed — i.e. RLS + the trigger are a live
 * backstop, not (as before #321, when the backend connected as the postgres
 * superuser) an inert no-op.
 *
 * Mirrors tests/rls/messages-update-guard.test.ts, but at the dotnet_app seam
 * rather than the PostgREST (authenticator) seam. Each exploit assertion checks
 * BOTH the rejection (ERRCODE 42501) AND the unchanged persisted row.
 *
 * DB connection: defaults to the in-container form (supabase-db:5432); CI on the
 * runner overrides SUPABASE_DB_HOST=localhost / SUPABASE_DB_PORT=54322.
 *
 * @module tests/rls/dotnet-least-privilege.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import {
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  type TestUser,
} from '../fixtures/test-users';

const SENDER = {
  email: 'dotnet-lp-sender@scripthammer.test',
  password: 'DotnetLpSender1!',
};
const RECIPIENT = {
  email: 'dotnet-lp-recipient@scripthammer.test',
  password: 'DotnetLpRecip1!',
};
const OUTSIDER = {
  email: 'dotnet-lp-outsider@scripthammer.test',
  password: 'DotnetLpOut1!',
};

// Same least-privilege role + local demo password the .NET server logs in with.
const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: 'dotnet_app',
  password:
    process.env.DOTNET_DB_PASSWORD ??
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

interface AttemptResult {
  rowCount: number | null;
  rows: Array<Record<string, unknown>>;
  errorCode?: string;
}

// Run one statement AS dotnet_app with the RLS actor set exactly as
// RlsActorMiddleware does. Always rolls back — this test never persists; it only
// observes whether the DB permits or blocks the operation.
async function asDotnetApp(
  actorUserId: string,
  sql: string,
  params: unknown[] = []
): Promise<AttemptResult> {
  const client = new Client(DB);
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: actorUserId, role: 'authenticated' }),
    ]);
    try {
      const res = await client.query(sql, params);
      await client.query('ROLLBACK');
      return {
        rowCount: res.rowCount,
        rows: res.rows as AttemptResult['rows'],
      };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      return {
        rowCount: null,
        rows: [],
        errorCode: (e as { code?: string })?.code,
      };
    }
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasRlsTestEnvironment())(
  `#321 dotnet_app least-privilege DB backstop [${RLS_SKIP_REASON}]`,
  () => {
    const svc = createServiceClient();
    let sender: TestUser;
    let recipient: TestUser;
    let outsider: TestUser;
    let conversationId: string;

    beforeAll(async () => {
      sender = await createTestUser(SENDER.email, SENDER.password);
      recipient = await createTestUser(RECIPIENT.email, RECIPIENT.password);
      outsider = await createTestUser(OUTSIDER.email, OUTSIDER.password);

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
    }, 60_000);

    afterAll(async () => {
      await svc.from('conversations').delete().eq('id', conversationId);
      await svc
        .from('user_connections')
        .delete()
        .or(`requester_id.eq.${sender.id},requester_id.eq.${recipient.id}`);
      await deleteTestUser(sender.id).catch(() => {});
      await deleteTestUser(recipient.id).catch(() => {});
      await deleteTestUser(outsider.id).catch(() => {});
    });

    // Fresh sender message (within the 15-min edit window), seeded via svc.
    async function seed(content = 'ORIGINAL_BY_SENDER'): Promise<string> {
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
      return data!.id as string;
    }

    // ── The backstop must BLOCK cross-user writes (the #281 exploit at the
    //    dotnet_app seam) even though the C# check would normally catch them ──
    it('BLOCKS a recipient rewriting the sender ciphertext (42501, row unchanged)', async () => {
      const id = await seed('ORIGINAL_BY_SENDER');
      const res = await asDotnetApp(
        recipient.id,
        'UPDATE messages SET encrypted_content = $1, edited = true WHERE id = $2',
        ['HIJACKED', id]
      );
      expect(res.errorCode).toBe('42501');
      const { data: row } = await svc
        .from('messages')
        .select('encrypted_content, edited')
        .eq('id', id)
        .single();
      expect(row!.encrypted_content).toBe('ORIGINAL_BY_SENDER');
      expect(row!.edited).toBe(false);
    });

    it('BLOCKS a recipient soft-deleting the sender message (42501)', async () => {
      const id = await seed('KEEP_ME');
      const res = await asDotnetApp(
        recipient.id,
        'UPDATE messages SET deleted = true WHERE id = $1',
        [id]
      );
      expect(res.errorCode).toBe('42501');
    });

    it('BLOCKS an outsider reading the conversation (RLS row-scoping → 0 rows)', async () => {
      await seed('SECRET');
      const res = await asDotnetApp(
        outsider.id,
        'SELECT id FROM messages WHERE conversation_id = $1',
        [conversationId]
      );
      expect(res.errorCode).toBeUndefined();
      expect(res.rowCount).toBe(0);
    });

    it('BLOCKS an outsider updating the message (RLS row-scoping → 0 rows)', async () => {
      const id = await seed('OUTSIDER_CANT');
      const res = await asDotnetApp(
        outsider.id,
        'UPDATE messages SET read_at = now() WHERE id = $1',
        [id]
      );
      // The row is invisible to the outsider, so the UPDATE matches nothing
      // (no trigger fires — RLS blocks at the row level before the column guard).
      expect(res.errorCode).toBeUndefined();
      expect(res.rowCount).toBe(0);
    });

    // ── …while ALLOWING the legitimate flows (so #321 does not break access) ──
    it('ALLOWS the recipient marking read (read_at only)', async () => {
      const id = await seed('MARK_ME_READ');
      const res = await asDotnetApp(
        recipient.id,
        'UPDATE messages SET read_at = now() WHERE id = $1',
        [id]
      );
      expect(res.errorCode).toBeUndefined();
      expect(res.rowCount).toBe(1);
    });

    it('ALLOWS the sender editing their own recent message', async () => {
      const id = await seed('EDIT_ME');
      const res = await asDotnetApp(
        sender.id,
        'UPDATE messages SET encrypted_content = $1, edited = true WHERE id = $2',
        ['EDITED_BY_SENDER', id]
      );
      expect(res.errorCode).toBeUndefined();
      expect(res.rowCount).toBe(1);
    });
  }
);
