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
  deleteConversations,
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
      if (groupId) await deleteConversations(service, [groupId]);
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
      // is_conversation_creator was retired in #1247 B2: no policy or client called it any more.
      for (const fn of ['is_conversation_member', 'is_conversation_owner']) {
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

    describe('the founder helpers answer only about the caller (#1247)', () => {
      // Both are SECURITY DEFINER and exist so a group's first seats can be written and read
      // back. Neither may tell anyone whether SOMEONE ELSE'S group has members yet.
      let unseated: string;

      beforeAll(async () => {
        const { data, error } = await service
          .from('conversations')
          .insert({
            is_group: true,
            group_name: 'RLS #1247 unseated',
            created_by: alice.id,
            current_key_version: 1,
          })
          .select('id')
          .single();
        if (error || !data)
          throw new Error(`seed unseated group: ${error?.message}`);
        unseated = data.id;
      });

      afterAll(async () => {
        if (unseated) await deleteConversations(service, [unseated]);
      });

      it('is_unseated_group_founder: an outsider learns nothing about another founder’s group', async () => {
        const { data, error } = await bobClient.rpc(
          'is_unseated_group_founder',
          {
            conv_id: unseated,
          }
        );
        expect(error).toBeNull();
        expect(data).toBe(false);
      });

      it('is_unseated_founder_of: naming yourself or the real creator changes nothing for an outsider', async () => {
        for (const creator of [bob.id, alice.id]) {
          const { data, error } = await bobClient.rpc(
            'is_unseated_founder_of',
            {
              conv_id: unseated,
              creator,
            }
          );
          expect(error).toBeNull();
          expect(data).toBe(false);
        }
      });

      it('CONTROL: the founder gets true until the first seat, then false', async () => {
        const before = await aliceClient.rpc('is_unseated_group_founder', {
          conv_id: unseated,
        });
        const beforeOf = await aliceClient.rpc('is_unseated_founder_of', {
          conv_id: unseated,
          creator: alice.id,
        });
        expect([before.data, beforeOf.data]).toEqual([true, true]);
        const { error } = await service.from('conversation_members').insert({
          conversation_id: unseated,
          user_id: alice.id,
          role: 'owner',
          key_version_joined: 1,
        });
        if (error) throw new Error(`seat: ${error.message}`);
        const after = await aliceClient.rpc('is_unseated_group_founder', {
          conv_id: unseated,
        });
        expect(after.data).toBe(false);
      });
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

      it('answers in the exact shape the Edge Functions send (#1245 A3)', async () => {
        // The handlers pass the caller's IP as both the identifier and p_ip_address, and
        // create-lead uses the booking_lead bucket — neither of which the tests above do.
        const ip = '203.0.113.47'; // TEST-NET-3, never a real client
        identifiers.push(ip);
        await service
          .from('rate_limit_attempts')
          .delete()
          .eq('identifier', ip)
          .eq('attempt_type', 'booking_lead');
        const { data, error } = await service.rpc('consume_rate_limit', {
          p_identifier: ip,
          p_attempt_type: 'booking_lead',
          p_ip_address: ip,
        });
        expect(error).toBeNull();
        expect(data).toMatchObject({ allowed: true, remaining: 4 });
        const { data: row } = await service
          .from('rate_limit_attempts')
          .select('attempt_count, ip_address')
          .eq('identifier', ip)
          .eq('attempt_type', 'booking_lead')
          .single();
        expect(row).toEqual({ attempt_count: 1, ip_address: ip });
      });

      it('an x-forwarded-for value that is not an address is an error, so the handler answers 503', async () => {
        // p_ip_address is INET: PostgREST refuses the cast before the function runs. The
        // handlers read any error as "cannot check" and fail closed — never as permission.
        const { data, error } = await service.rpc('consume_rate_limit', {
          p_identifier: 'not-an-address',
          p_attempt_type: 'booking_lead',
          p_ip_address: 'not-an-address',
        });
        expect(error).not.toBeNull();
        expect(data).toBeNull();
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

    describe('the lockout pair answers a client with a constant and writes nothing (#1245 A2)', () => {
      // Stage A2. The pair stays anon-executable so a tab still running the pre-A2 bundle does
      // not fail closed (its wrapper reads any error as "locked"), but a client's answer no
      // longer depends on, or changes, anyone's history. Before A2, five anonymous
      // record_failed_attempt calls with someone else's email locked that person out of
      // sign-in for fifteen minutes, renewable forever, and check_rate_limit told anyone
      // whether a given email was under attack.
      const seedLocked = async (id: string) => {
        const { error } = await service.from('rate_limit_attempts').insert({
          identifier: id,
          attempt_type: 'sign_in',
          attempt_count: 6,
          window_start: new Date().toISOString(),
          locked_until: new Date(Date.now() + 15 * 60_000).toISOString(),
        });
        if (error)
          throw new Error(`could not seed a lockout: ${error.message}`);
      };
      const rowFor = async (id: string) => {
        const { data, error } = await service
          .from('rate_limit_attempts')
          .select('attempt_count, locked_until')
          .eq('identifier', id);
        if (error)
          throw new Error(`could not read the limiter: ${error.message}`);
        return data ?? [];
      };

      it('six failed attempts recorded by a client write nothing, so nobody is locked out', async () => {
        for (const [who, client] of [
          ['anon', anon],
          ['signed-in', aliceClient],
        ] as const) {
          const id = fresh(`record-${who}`);
          identifiers.push(id);
          for (let i = 0; i < 6; i++) {
            const { error } = await client.rpc('record_failed_attempt', {
              p_identifier: id,
              p_attempt_type: 'sign_in',
            });
            // Still callable: an error here is what an old tab would read as a lockout.
            expect(error).toBeNull();
          }
          expect({ who, rows: await rowFor(id) }).toEqual({ who, rows: [] });
        }
      });

      it('a client asking about a locked identifier is told nothing, and the lockout is left alone', async () => {
        const id = fresh('oracle');
        identifiers.push(id);
        await seedLocked(id);
        for (const client of [anon, aliceClient]) {
          const { data, error } = await client.rpc('check_rate_limit', {
            p_identifier: id,
            p_attempt_type: 'sign_in',
          });
          expect(error).toBeNull();
          // The whole shape: a pre-A2 tab computes `remaining - 1` from it.
          expect(data).toEqual({
            allowed: true,
            remaining: 5,
            locked_until: null,
          });
        }
        const rows = await rowFor(id);
        expect(rows).toHaveLength(1);
        expect(rows[0].attempt_count).toBe(6);
        expect(
          new Date(rows[0].locked_until as string).getTime()
        ).toBeGreaterThan(Date.now());
      });

      it('a client asking about an identifier nobody has used creates no row', async () => {
        // Before A2 the first check for any string inserted a bucket for it, so anyone could
        // grow the table one arbitrary identifier at a time.
        for (const [who, client] of [
          ['anon', anon],
          ['signed-in', aliceClient],
        ] as const) {
          const id = fresh(`probe-${who}`);
          identifiers.push(id);
          const { error } = await client.rpc('check_rate_limit', {
            p_identifier: id,
            p_attempt_type: 'sign_in',
          });
          expect(error).toBeNull();
          expect({ who, rows: await rowFor(id) }).toEqual({ who, rows: [] });
        }
      });

      it('a client call takes no row lock, so it cannot be made to wait on one', async () => {
        const id = fresh('nowait');
        identifiers.push(id);
        await seedLocked(id);
        const holder = new Client(DB);
        const caller = new Client(DB);
        await holder.connect();
        await caller.connect();
        try {
          await holder.query('begin');
          await holder.query(
            `select 1 from rate_limit_attempts where identifier = $1 for update`,
            [id]
          );
          await caller.query('begin');
          await caller.query(
            `select set_config('request.jwt.claims', '{"role":"anon"}', true)`
          );
          // Before A2 this call queued behind the holder until the timeout.
          await caller.query(`set local statement_timeout = '1500ms'`);
          const { rows } = await caller.query(
            `select check_rate_limit($1, 'sign_in') as r`,
            [id]
          );
          expect(rows[0].r).toEqual({
            allowed: true,
            remaining: 5,
            locked_until: null,
          });
        } finally {
          await caller.query('rollback').catch(() => undefined);
          await holder.query('rollback').catch(() => undefined);
          await holder.end();
          await caller.end();
        }
      });

      it('CONTROL: the service role still records, and still gets the real answer', async () => {
        // The service role is the only caller the pair still answers for real — nothing in the
        // repo calls it since #1245 A3, but redeploying the pre-A3 Edge Functions (the rollback)
        // would. Without this test, a body that answered everyone "allowed" would pass the two
        // above.
        const locked = fresh('svc-locked');
        identifiers.push(locked);
        await seedLocked(locked);
        const check = await service.rpc('check_rate_limit', {
          p_identifier: locked,
          p_attempt_type: 'sign_in',
        });
        expect(check.error).toBeNull();
        expect(check.data).toMatchObject({ allowed: false });

        const counted = fresh('svc-record');
        identifiers.push(counted);
        const rec = await service.rpc('record_failed_attempt', {
          p_identifier: counted,
          p_attempt_type: 'sign_in',
        });
        expect(rec.error).toBeNull();
        expect(await rowFor(counted)).toMatchObject([{ attempt_count: 1 }]);
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

    describe('log_auth_event pins a signed-in caller to their own id (#1245 review)', () => {
      it('an unattributed event from a signed-in user is recorded against that user, not against no one', async () => {
        const marker = fresh('attrib');
        const { error } = await aliceClient.rpc('log_auth_event', {
          p_event_type: 'sign_in_success',
          p_event_data: { marker },
        });
        expect(error).toBeNull();
        const { data } = await service
          .from('auth_audit_logs')
          .select('user_id')
          .contains('event_data', { marker });
        expect(data).toEqual([{ user_id: alice.id }]);
        await service
          .from('auth_audit_logs')
          .delete()
          .contains('event_data', { marker });
      });

      it('no client, signed in or not, may write a successful sign-up — the database records those', async () => {
        const signedIn = await aliceClient.rpc('log_auth_event', {
          p_event_type: 'sign_up',
          p_success: true,
        });
        expect(refused(signedIn.error)).toBe(true);
        const defaulted = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_up',
        });
        expect(refused(defaulted.error)).toBe(true); // p_success defaults to TRUE
      });

      it('CONTROL: a failed sign-up is still logged from the form', async () => {
        const marker = fresh('signup-fail');
        const { error } = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_up',
          p_success: false,
          p_event_data: { marker },
        });
        expect(error).toBeNull();
        await service
          .from('auth_audit_logs')
          .delete()
          .contains('event_data', { marker });
      });
    });

    describe('consume_rate_limit keys on the identity, not its spelling (#1245 review)', () => {
      it('case and whitespace variants of one address share one bucket', async () => {
        const base = fresh('spell');
        identifiers.push(base.toLowerCase());
        const spellings = [
          base.toUpperCase(),
          base,
          ` ${base} `,
          base.toLowerCase(),
          `${base}\t`,
        ];
        for (const id of spellings) {
          const r = await service.rpc('consume_rate_limit', {
            p_identifier: id,
            p_attempt_type: 'contact_form',
          });
          expect(r.data?.allowed, `spelling ${JSON.stringify(id)}`).toBe(true);
        }
        const sixth = await service.rpc('consume_rate_limit', {
          p_identifier: base.toUpperCase(),
          p_attempt_type: 'contact_form',
        });
        expect(sixth.data?.allowed).toBe(false);
      });

      it('two spellings of one IPv6 address share one bucket', async () => {
        const n = Math.floor(Math.random() * 0xfff0) + 1;
        const short = `fd00::${n.toString(16)}`;
        const long = `fd00:0:0:0:0:0:0:${n.toString(16)}`;
        identifiers.push(short);
        for (let i = 0; i < 5; i++)
          await service.rpc('consume_rate_limit', {
            p_identifier: i % 2 ? long : short,
            p_attempt_type: 'contact_form',
          });
        const sixth = await service.rpc('consume_rate_limit', {
          p_identifier: long,
          p_attempt_type: 'contact_form',
        });
        expect(sixth.data?.allowed).toBe(false);
      });
    });

    describe('the guards answer true or false, never NULL, without JWT claims (#1245 review)', () => {
      it('a caller with no claims (Management API, cron) gets a definite false for someone else', async () => {
        const db = new Client(DB);
        await db.connect();
        try {
          const { rows } = await db.query(
            `select is_conversation_member($1, $2) as m, is_conversation_owner($1, $2) as o,
                    is_admin($2) as a`,
            [groupId, bob.id]
          );
          // NULL here is what a plpgsql `IF NOT is_conversation_member(...) THEN RAISE` skips.
          expect(rows[0]).toEqual({ m: false, o: false, a: false });
        } finally {
          await db.end();
        }
      });
    });
  }
);
