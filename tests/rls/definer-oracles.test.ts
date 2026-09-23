/**
 * What the SECURITY DEFINER functions answer, and to whom (#1245, #1237).
 *
 * Every function here runs as its owner, so RLS does not stand between the caller and the
 * data it reads. The only boundaries are who may EXECUTE it and what its body agrees to say.
 * Each block pins one of those, with a CONTROL that proves the path still works for the caller
 * it exists for — a refusal test on its own passes against a function that refuses everyone.
 *
 * Runs against a live stack; raw Postgres is used where only a direct connection can show the
 * behaviour (holding a row lock, calling as the function owner).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createAnonClient,
  createServiceClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: process.env.SUPABASE_DB_USER ?? 'postgres',
  password:
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

const fresh = (tag: string) =>
  `rls-1245-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** PostgREST reports a withheld EXECUTE as 42501. */
const refused = (error: { code?: string } | null) => error?.code === '42501';

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: definer oracles and the limiter (#1245, #1237) [${RLS_SKIP_REASON}]`,
  () => {
    let alice: TestUser; // an ordinary signed-in user — the would-be prober
    let bob: TestUser; // an admin, and the only member of the group
    let aliceClient: SupabaseClient;
    let bobClient: SupabaseClient;
    let service: SupabaseClient;
    let anon: SupabaseClient;
    let groupId: string;
    const identifiers: string[] = [];

    beforeAll(async () => {
      service = createServiceClient();
      anon = createAnonClient();
      alice = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      bob = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      const { error: adminError } = await service
        .from('user_profiles')
        .update({ is_admin: true })
        .eq('id', bob.id);
      if (adminError)
        throw new Error(`could not make bob an admin: ${adminError.message}`);
      aliceClient = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      bobClient = await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );

      const { data: conv, error } = await service
        .from('conversations')
        .insert({
          is_group: true,
          group_name: 'RLS #1245 fixture',
          created_by: bob.id,
          current_key_version: 1,
        })
        .select('id')
        .single();
      if (error || !conv)
        throw new Error(`could not seed group: ${error?.message}`);
      groupId = conv.id;
      const { error: memberError } = await service
        .from('conversation_members')
        .insert({
          conversation_id: groupId,
          user_id: bob.id,
          role: 'owner',
          key_version_joined: 1,
          key_status: 'active',
        });
      if (memberError)
        throw new Error(`could not seed member: ${memberError.message}`);
    });

    afterAll(async () => {
      if (groupId)
        await service.from('conversations').delete().eq('id', groupId);
      if (identifiers.length)
        await service
          .from('rate_limit_attempts')
          .delete()
          .in('identifier', identifiers);
      if (bob)
        await service
          .from('user_profiles')
          .update({ is_admin: false })
          .eq('id', bob.id);
      if (alice) await deleteTestUser(alice.id);
      if (bob) await deleteTestUser(bob.id);
    });

    describe('is_admin answers only about the caller', () => {
      it('a signed-in non-admin cannot learn that someone else is an admin', async () => {
        const { data, error } = await aliceClient.rpc('is_admin', {
          check_user_id: bob.id,
        });
        expect(error).toBeNull();
        expect(data).toBe(false);
      });

      it('neither can an anonymous caller', async () => {
        const { data, error } = await anon.rpc('is_admin', {
          check_user_id: bob.id,
        });
        expect(error).toBeNull();
        expect(data).toBe(false);
      });

      it('CONTROL: the service role still gets the real answer', async () => {
        const { data, error } = await service.rpc('is_admin', {
          check_user_id: bob.id,
        });
        expect(error).toBeNull();
        expect(data).toBe(true);
      });

      it('CONTROL: the admin asking about himself, via the default argument, gets true', async () => {
        const { data, error } = await bobClient.rpc('is_admin');
        expect(error).toBeNull();
        expect(data).toBe(true);
      });

      it('CONTROL: an admin may still ask about others (admin_user_stats does, per row)', async () => {
        const { data, error } = await bobClient.rpc('is_admin', {
          check_user_id: alice.id,
        });
        expect(error).toBeNull();
        expect(data).toBe(false); // the real answer: alice is not an admin
      });
    });

    describe('membership helpers answer only about the caller', () => {
      for (const fn of [
        'is_conversation_member',
        'is_conversation_owner',
        'is_conversation_creator',
      ]) {
        it(`${fn}: a non-member cannot learn that someone else belongs`, async () => {
          const { data, error } = await aliceClient.rpc(fn, {
            conv_id: groupId,
            check_user_id: bob.id,
          });
          expect(error).toBeNull();
          expect(data).toBe(false);
        });

        it(`${fn}: CONTROL — the service role sees the truth, and so does the member about himself`, async () => {
          const viaService = await service.rpc(fn, {
            conv_id: groupId,
            check_user_id: bob.id,
          });
          expect(viaService.error).toBeNull();
          expect(viaService.data).toBe(true);
          const self = await bobClient.rpc(fn, { conv_id: groupId });
          expect(self.error).toBeNull();
          expect(self.data).toBe(true);
        });
      }
    });

    describe('consume_rate_limit decides atomically (#1237)', () => {
      it('twenty concurrent consumes on one identifier allow exactly five', async () => {
        const id = fresh('burst');
        identifiers.push(id);
        const results = await Promise.all(
          Array.from({ length: 20 }, () =>
            service.rpc('consume_rate_limit', {
              p_identifier: id,
              p_attempt_type: 'contact_form',
            })
          )
        );
        for (const r of results) expect(r.error).toBeNull();
        expect(results.filter((r) => r.data?.allowed === true)).toHaveLength(5);
      });

      it('CONTROL: check-then-record lets the same burst straight through', async () => {
        // Why the atomic function exists: every check completes before any record, so the
        // two-call pattern admits all twenty. Deterministic — it does not rely on lock timing.
        const id = fresh('race');
        identifiers.push(id);
        const checks = await Promise.all(
          Array.from({ length: 20 }, () =>
            service.rpc('check_rate_limit', {
              p_identifier: id,
              p_attempt_type: 'contact_form',
            })
          )
        );
        await Promise.all(
          Array.from({ length: 20 }, () =>
            service.rpc('record_failed_attempt', {
              p_identifier: id,
              p_attempt_type: 'contact_form',
            })
          )
        );
        expect(
          checks.filter((r) => r.data?.allowed === true).length
        ).toBeGreaterThan(5);
      });

      it('the sixth sequential consume is refused, with the lockout named', async () => {
        const id = fresh('seq');
        identifiers.push(id);
        let last: { allowed?: boolean; locked_until?: string | null } | null =
          null;
        for (let i = 0; i < 6; i++) {
          const r = await service.rpc('consume_rate_limit', {
            p_identifier: id,
            p_attempt_type: 'contact_form',
          });
          expect(r.error).toBeNull();
          last = r.data;
        }
        expect(last?.allowed).toBe(false);
        expect(last?.locked_until).toBeTruthy();
      });

      it('no client role may choose the identifier', async () => {
        const args = {
          p_identifier: fresh('client'),
          p_attempt_type: 'contact_form',
        };
        expect(
          refused((await anon.rpc('consume_rate_limit', args)).error)
        ).toBe(true);
        expect(
          refused((await aliceClient.rpc('consume_rate_limit', args)).error)
        ).toBe(true);
      });
    });

    describe('check_rate_limit waits for a held lock instead of resetting (#1237)', () => {
      it('a caller that meets a held lock, once it is released, still reports the lockout and leaves it in place', async () => {
        // The #1237 bug does not show while the lock is held: the reset path's ON CONFLICT also
        // waits for the row. It shows on RELEASE — SKIP LOCKED had already chosen "no history",
        // so the caller woke up, zeroed the count, cleared locked_until and said allowed:true.
        // (A first draft asserted a timeout while the lock was held; it passed against the
        // broken code, and the red run is what caught it.)
        const id = fresh('lock');
        identifiers.push(id);
        const holder = new Client(DB);
        const caller = new Client(DB);
        await holder.connect();
        await caller.connect();
        try {
          await holder.query(
            `insert into rate_limit_attempts (identifier, attempt_type, attempt_count, window_start, locked_until)
             values ($1, 'sign_in', 6, now(), now() + interval '15 minutes')`,
            [id]
          );
          await holder.query('begin');
          await holder.query(
            `select 1 from rate_limit_attempts where identifier = $1 and attempt_type = 'sign_in' for update`,
            [id]
          );

          await caller.query('begin');
          // As the service role — the limiter's legitimate caller — so this survives stage A2.
          await caller.query(
            `select set_config('request.jwt.claims', '{"role":"service_role"}', true)`
          );
          await caller.query(`set local statement_timeout = '10s'`);
          const pending = caller.query(
            `select check_rate_limit($1, 'sign_in') as r`,
            [id]
          );
          await new Promise((r) => setTimeout(r, 750));
          await holder.query('rollback'); // release the lock mid-call
          const { rows } = await pending;
          await caller.query('commit');

          expect(rows[0].r.allowed).toBe(false);
          const after = await holder.query(
            `select locked_until > now() as still_locked, attempt_count from rate_limit_attempts where identifier = $1`,
            [id]
          );
          expect(after.rows[0]).toEqual({
            still_locked: true,
            attempt_count: 6,
          });
        } finally {
          await holder.end();
          await caller.end();
        }
      });

      it('CONTROL: with no lock held, the same call returns at once and reports the lockout', async () => {
        const id = fresh('nolock');
        identifiers.push(id);
        const db = new Client(DB);
        await db.connect();
        try {
          await db.query(
            `insert into rate_limit_attempts (identifier, attempt_type, attempt_count, window_start, locked_until)
             values ($1, 'sign_in', 6, now(), now() + interval '15 minutes')`,
            [id]
          );
          await db.query('begin');
          await db.query(
            `select set_config('request.jwt.claims', '{"role":"service_role"}', true)`
          );
          await db.query(`set local statement_timeout = '1500ms'`);
          const { rows } = await db.query(
            `select check_rate_limit($1, 'sign_in') as r`,
            [id]
          );
          await db.query('rollback');
          expect(rows[0].r.allowed).toBe(false);
        } finally {
          await db.end();
        }
      });
    });

    describe('cleanup_old_audit_logs is closed to every client role', () => {
      it('anon, a signed-in user and the service role are all refused', async () => {
        expect(refused((await anon.rpc('cleanup_old_audit_logs')).error)).toBe(
          true
        );
        expect(
          refused((await aliceClient.rpc('cleanup_old_audit_logs')).error)
        ).toBe(true);
        expect(
          refused((await service.rpc('cleanup_old_audit_logs')).error)
        ).toBe(true);
      });

      it('CONTROL: its owner (the retention job) still runs it, and a zero batch no longer spins', async () => {
        const db = new Client(DB);
        await db.connect();
        try {
          await db.query(`set statement_timeout = '5000ms'`);
          const { rows } = await db.query(
            'select cleanup_old_audit_logs(0, 1) as n'
          );
          expect(typeof rows[0].n).toBe('number');
        } finally {
          await db.end();
        }
      });
    });

    describe('log_auth_event bounds what an anonymous caller may write', () => {
      it('refuses a forged successful sign-up', async () => {
        const { error } = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_up',
          p_success: true,
        });
        expect(refused(error)).toBe(true);
      });

      it('refuses a forged successful sign-in', async () => {
        const { error } = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_in_success',
        });
        expect(refused(error)).toBe(true);
      });

      it('refuses an oversized payload', async () => {
        const { error } = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_success: false,
          p_event_data: { blob: 'x'.repeat(5000) },
        });
        expect(error?.code).toBe('22001');
      });

      it('CONTROL: the pre-session events the forms really send still land', async () => {
        const marker = fresh('audit');
        const failed = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_success: false,
          p_event_data: { marker },
        });
        expect(failed.error).toBeNull();
        const reset = await anon.rpc('log_auth_event', {
          p_event_type: 'password_reset_request',
          p_event_data: { marker },
        });
        expect(reset.error).toBeNull();
        const { data } = await service
          .from('auth_audit_logs')
          .select('event_type')
          .contains('event_data', { marker });
        expect((data ?? []).map((r) => r.event_type).sort()).toEqual([
          'password_reset_request',
          'sign_in_failed',
        ]);
        await service
          .from('auth_audit_logs')
          .delete()
          .contains('event_data', { marker });
      });
    });
  }
);
