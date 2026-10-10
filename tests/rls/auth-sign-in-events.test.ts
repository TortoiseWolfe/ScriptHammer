/**
 * Sign-ins are recorded by the database, and nothing a browser sends can add to them (#1284).
 *
 * The admin dashboard's "Logins Today", its logins sparkline and the audit page's
 * "Successful Sign-ins" all counted `auth_audit_logs` rows that the BROWSER wrote, through
 * `log_auth_event()`. Two things were wrong with that:
 *
 *   - any signed-in account could call the RPC as often as it liked, so one user could set
 *     the number to anything;
 *   - the browser missed nearly every real sign-in. Measured on production, 2026-10-10:
 *     14 sessions created in 30 days, ONE client-written success row.
 *
 * The row now comes from a trigger on `auth.users.last_sign_in_at`, which GoTrue sets to a new
 * value when it issues a new session and which no client can write. These tests sign in for
 * real, against real GoTrue, so they pin GoTrue's behaviour as well as ours. A token refresh
 * DOES rewrite the column, with its existing value (GoTrue v2.177.0); the trigger's WHEN clause
 * is what keeps that from counting, and the refresh test fails if a refresh ever counts, for
 * either reason.
 *
 * Anonymous telemetry (failed sign-ins, reset requests) stays client-written, because nothing
 * server-side sees a failed password. What changes is that it is bounded: a smaller payload,
 * and a site-wide hourly ceiling, since a caller with no session cannot be told apart from
 * another one. Past the ceiling an event is counted in auth_audit_overflow instead of stored,
 * so a flood stays visible. A failed sign-in may no longer come from a caller WITH a session,
 * which is the one path that escaped the ceiling.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createAnonClient,
  createAuthenticatedClient,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

// Mirrors log_auth_event() in the monolithic migration. Kept as a literal rather than read
// back from the database, so that loosening the ceiling there is a visible change here.
const ANON_HOURLY_CEILING = 30;

// Raw Postgres, for the one test that has to write auth.users the way GoTrue does.
const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: process.env.SUPABASE_DB_USER ?? 'postgres',
  password:
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: sign-ins are written by the database, not the browser (#1284) [${RLS_SKIP_REASON}]`,
  () => {
    let member: TestUser;
    let admin: TestUser;
    let memberClient: SupabaseClient;
    let adminClient: SupabaseClient;
    let service: SupabaseClient;
    const marker = `e1284-${Date.now()}`;

    async function rowsFor(userId: string, types: string[]): Promise<number> {
      const { count, error } = await service
        .from('auth_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('event_type', types);
      if (error) throw new Error(`could not count rows: ${error.message}`);
      return count ?? 0;
    }
    const signIns = (userId: string) => rowsFor(userId, ['sign_in']);
    const anySuccessName = (userId: string) =>
      rowsFor(userId, ['sign_in', 'sign_in_success']);

    async function loginsToday(): Promise<number> {
      const { data, error } = await adminClient.rpc('admin_auth_stats');
      if (error) throw new Error(`admin_auth_stats failed: ${error.message}`);
      return (data as { logins_today: number }).logins_today;
    }

    /** Every dashboard number that counts successful sign-ins. */
    async function dashboardSignIns() {
      const overview = await adminClient.rpc('admin_overview');
      const trends = await adminClient.rpc('admin_audit_trends');
      if (overview.error || trends.error)
        throw new Error(
          `dashboard read failed: ${overview.error?.message ?? trends.error?.message}`
        );
      const logins = (overview.data as { sparks: { logins: number[] } }).sparks
        .logins;
      const t = trends.data as {
        totals: { sign_in_success: number };
        daily_series: { succeeded: number }[];
      };
      return {
        today: await loginsToday(),
        spark: logins[logins.length - 1],
        total: t.totals.sign_in_success,
        daily: t.daily_series[t.daily_series.length - 1].succeeded,
      };
    }

    async function clearAnonMarkerRows() {
      const { error } = await service
        .from('auth_audit_logs')
        .delete()
        .eq('event_data->>marker', marker)
        .is('user_id', null);
      if (error) throw new Error(`could not clear rows: ${error.message}`);
    }

    /** Service-role rows with no user, so the next anonymous call meets `target` already there. */
    async function fillAnonRowsTo(target: number) {
      const fill = target - (await anonRowsThisHour());
      // Fail loudly rather than test nothing: rows from other suites already past the target.
      expect(fill).toBeGreaterThanOrEqual(0);
      if (fill === 0) return;
      const { error } = await service.from('auth_audit_logs').insert(
        Array.from({ length: fill }, () => ({
          event_type: 'sign_in_failed',
          success: false,
          event_data: { marker },
        }))
      );
      if (error) throw new Error(`could not fill: ${error.message}`);
    }

    async function anonRowsThisHour(): Promise<number> {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await service
        .from('auth_audit_logs')
        .select('*', { count: 'exact', head: true })
        .is('user_id', null)
        .gt('created_at', since);
      if (error) throw new Error(`could not count anon rows: ${error.message}`);
      return count ?? 0;
    }

    // auth_audit_overflow rows from the last two clock hours: the ones this file can touch.
    // Snapshotted before and restored after, so other suites see the counter as it was.
    const recentHours = () =>
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    let overflowSnapshot: { hour: string; dropped: number }[] = [];

    async function droppedRecently(): Promise<number> {
      const { data, error } = await service
        .from('auth_audit_overflow')
        .select('dropped')
        .gte('hour', recentHours());
      if (error) throw new Error(`could not read overflow: ${error.message}`);
      return (data ?? []).reduce(
        (n: number, r: { dropped: number }) => n + r.dropped,
        0
      );
    }

    async function droppedThisWeek(): Promise<number> {
      const { data, error } = await adminClient.rpc('admin_auth_stats');
      if (error) throw new Error(`admin_auth_stats failed: ${error.message}`);
      return (data as { reports_dropped_this_week: number })
        .reports_dropped_this_week;
    }

    beforeAll(async () => {
      service = createServiceClient();
      member = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      admin = await createTestUser(
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );
      const { error } = await service
        .from('user_profiles')
        .update({ is_admin: true })
        .eq('id', admin.id);
      if (error) throw new Error(`could not make the admin: ${error.message}`);
      memberClient = await createAuthenticatedClient(
        member.email,
        member.password
      );
      adminClient = await createAuthenticatedClient(
        admin.email,
        admin.password
      );
      const { data, error: snapErr } = await service
        .from('auth_audit_overflow')
        .select('hour, dropped')
        .gte('hour', recentHours());
      if (snapErr) throw new Error(`overflow snapshot: ${snapErr.message}`);
      overflowSnapshot = data ?? [];
    });

    afterAll(async () => {
      await service
        .from('auth_audit_logs')
        .delete()
        .eq('event_data->>marker', marker);
      await service
        .from('auth_audit_overflow')
        .delete()
        .gte('hour', recentHours());
      if (overflowSnapshot.length)
        await service.from('auth_audit_overflow').insert(overflowSnapshot);
      if (admin)
        await service
          .from('user_profiles')
          .update({ is_admin: false })
          .eq('id', admin.id);
      if (member) await deleteTestUser(member.id);
      if (admin) await deleteTestUser(admin.id);
    });

    describe('the server-written row', () => {
      it('creating a user through the admin API is not a sign-in', async () => {
        const fresh = await createTestUser(
          TEST_USERS.userB.email,
          TEST_USERS.userB.password
        );
        try {
          expect(await signIns(fresh.id)).toBe(0);
        } finally {
          await deleteTestUser(fresh.id);
        }
      });

      it('a password sign-in writes exactly one sign_in row, marked as the database’s', async () => {
        const before = await signIns(member.id);
        await createAuthenticatedClient(member.email, member.password);
        expect(await signIns(member.id)).toBe(before + 1);

        const { data, error } = await service
          .from('auth_audit_logs')
          .select('success, event_data, user_agent')
          .eq('user_id', member.id)
          .eq('event_type', 'sign_in')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        expect(error).toBeNull();
        expect(data?.success).toBe(true);
        expect(data?.event_data).toEqual({ source: 'auth.users' });
        // No browser was involved, so nothing browser-reported is recorded.
        expect(data?.user_agent).toBeNull();
      });

      it('a token refresh is not a sign-in', async () => {
        const client = await createAuthenticatedClient(
          member.email,
          member.password
        );
        const before = await signIns(member.id);
        const { error } = await client.auth.refreshSession();
        expect(error).toBeNull();
        expect(await signIns(member.id)).toBe(before);
      });

      it('an update to the user that is not a sign-in writes nothing', async () => {
        const before = await signIns(member.id);
        const { error } = await service.auth.admin.updateUserById(member.id, {
          user_metadata: { touched: marker },
        });
        expect(error).toBeNull();
        expect(await signIns(member.id)).toBe(before);
      });

      it('the column being rewritten unchanged, or cleared, is not a sign-in', async () => {
        // `UPDATE OF last_sign_in_at` fires whenever the column is in the SET list. GoTrue's
        // admin update above does not happen to name it, so this writes it directly, the way
        // a whole-row save would.
        const db = new Client(DB);
        await db.connect();
        try {
          const before = await signIns(member.id);
          await db.query(
            'update auth.users set last_sign_in_at = last_sign_in_at where id = $1',
            [member.id]
          );
          await db.query(
            'update auth.users set last_sign_in_at = null where id = $1',
            [member.id]
          );
          expect(await signIns(member.id)).toBe(before);

          // CONTROL: a new value through the same door does count.
          await db.query(
            'update auth.users set last_sign_in_at = now() where id = $1',
            [member.id]
          );
          expect(await signIns(member.id)).toBe(before + 1);
        } finally {
          await db.end();
        }
      });
    });

    describe('what a client may no longer write', () => {
      for (const [eventType, success] of [
        ['sign_in_success', true],
        ['sign_in', true],
        ['sign_in', false],
      ] as const) {
        it(`a signed-in user cannot mint '${eventType}' (success=${success})`, async () => {
          const before = await anySuccessName(member.id);
          const { error } = await memberClient.rpc('log_auth_event', {
            p_event_type: eventType,
            p_event_data: { marker },
            p_success: success,
          });
          expect(error?.code).toBe('42501');
          expect(await anySuccessName(member.id)).toBe(before);
        });
      }

      it('logins_today moves for a real sign-in and not for a minted one', async () => {
        const before = await loginsToday();

        for (let i = 0; i < 5; i++) {
          await memberClient.rpc('log_auth_event', {
            p_event_type: 'sign_in_success',
            p_event_data: { marker },
          });
        }
        expect(await loginsToday()).toBe(before);

        await createAuthenticatedClient(member.email, member.password);
        expect(await loginsToday()).toBe(before + 1);
      });

      it('the overview sparkline and the audit totals count the same row', async () => {
        const before = await dashboardSignIns();
        await createAuthenticatedClient(member.email, member.password);
        expect(await dashboardSignIns()).toEqual({
          today: before.today + 1,
          spark: before.spark + 1,
          total: before.total + 1,
          daily: before.daily + 1,
        });
      });

      it("a browser-written 'sign_in_success' row from before the change is not counted", async () => {
        // Production holds 2,215 of these, and any signed-in account could have written one.
        // Refusing new ones is not enough on its own; the readers have to leave them out too.
        const before = await dashboardSignIns();
        const { error } = await service.from('auth_audit_logs').insert({
          user_id: member.id,
          event_type: 'sign_in_success',
          success: true,
          event_data: { marker },
        });
        expect(error).toBeNull();
        expect(await dashboardSignIns()).toEqual(before);
      });

      it('a signed-in user cannot log a failed sign-in, the one path that escaped the ceiling', async () => {
        // A failed sign-in happens before any session exists. Accepted from a session, these
        // rows were attributed to the caller and so outside the anonymous ceiling: one free
        // account could raise failed_this_week, and the alert it drives, without limit.
        const before = await rowsFor(member.id, ['sign_in_failed']);
        const { error } = await memberClient.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_event_data: { marker },
          p_success: false,
        });
        expect(error?.code).toBe('42501');
        expect(await rowsFor(member.id, ['sign_in_failed'])).toBe(before);
      });

      it('CONTROL: a signed-in user can still log their own non-sign-in events', async () => {
        // Without this, a function that refused everything would pass every test above.
        const { error } = await memberClient.rpc('log_auth_event', {
          p_event_type: 'password_change',
          p_event_data: { marker },
        });
        expect(error).toBeNull();
      });
    });

    describe('anonymous telemetry is bounded', () => {
      it('a caller with no session gets a smaller payload than a signed-in one', async () => {
        const anon = createAnonClient();
        const big = { marker, email: 'x'.repeat(600) };
        const refused = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_event_data: big,
          p_success: false,
        });
        expect(refused.error?.code).toBe('22001');

        // CONTROL: the same payload is fine for a signed-in caller, whose limit is 4 KB.
        const allowed = await memberClient.rpc('log_auth_event', {
          p_event_type: 'password_change',
          p_event_data: big,
        });
        expect(allowed.error).toBeNull();
      });

      it('past a site-wide hourly ceiling an anonymous event is counted, not stored; service_role is exempt', async () => {
        const anon = createAnonClient();
        await clearAnonMarkerRows();
        await fillAnonRowsTo(ANON_HOURLY_CEILING);
        const atCeiling = await anonRowsThisHour();
        expect(atCeiling).toBe(ANON_HOURLY_CEILING);
        const droppedBefore = await droppedRecently();
        const weekBefore = await droppedThisWeek();

        // No error: the event IS recorded, as a number. Raising would roll the count back.
        const counted = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_event_data: { marker },
          p_success: false,
        });
        expect(counted.error).toBeNull();
        expect(await anonRowsThisHour()).toBe(atCeiling);
        expect(await droppedRecently()).toBe(droppedBefore + 1);
        // ...and it reaches the dashboard, which is the point: a flood stays visible.
        expect(await droppedThisWeek()).toBe(weekBefore + 1);

        const server = await service.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_event_data: { marker },
          p_success: false,
        });
        expect(server.error).toBeNull();

        // CONTROL: below the ceiling, the same anonymous call is accepted. Without this, a
        // function that refused every anonymous call would pass the assertion above.
        await clearAnonMarkerRows();
        expect(await anonRowsThisHour()).toBeLessThan(ANON_HOURLY_CEILING);
        const accepted = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_event_data: { marker },
          p_success: false,
        });
        expect(accepted.error).toBeNull();
      });

      it('two callers overlapping at the last slot: the second waits for the first, then is counted', async () => {
        // Without the lock, the second caller counts 29 while the first has not committed, and
        // both write. A first draft raced eight PostgREST calls at once instead; it stayed green
        // with the lock deleted, because nothing made them overlap. This makes them.
        await clearAnonMarkerRows();
        await fillAnonRowsTo(ANON_HOURLY_CEILING - 1);
        const droppedBefore = await droppedRecently();
        const asAnon = `select set_config('request.jwt.claims', '{"role":"anon"}', true)`;
        const call = `select log_auth_event('sign_in_failed', null, $1::jsonb, false)`;
        const payload = [JSON.stringify({ marker })];
        const holder = new Client(DB);
        const caller = new Client(DB);
        await holder.connect();
        await caller.connect();
        try {
          await holder.query('begin');
          await holder.query(asAnon);
          await holder.query(call, payload); // takes the last slot, not yet committed

          await caller.query('begin');
          await caller.query(asAnon);
          await caller.query(`set local statement_timeout = '10s'`);
          let settled = false;
          const pending = caller.query(call, payload).then(
            () => {
              settled = true;
              return null;
            },
            (e: { code?: string }) => {
              settled = true;
              return e;
            }
          );
          await new Promise((r) => setTimeout(r, 750));
          expect(settled).toBe(false);

          await holder.query('commit');
          const err = await pending;
          await caller.query('commit');
          expect(err).toBeNull();
          expect(await anonRowsThisHour()).toBe(ANON_HOURLY_CEILING);
          expect(await droppedRecently()).toBe(droppedBefore + 1);
        } finally {
          await holder.end();
          await caller.end();
          await clearAnonMarkerRows();
        }
      });
    });

    describe('the overflow counter', () => {
      it('only an admin can read it, and no client role can write it', async () => {
        // It must exist for the reads below to mean anything; the tests above wrote to it.
        expect(await droppedRecently()).toBeGreaterThan(0);

        const asMember = await memberClient
          .from('auth_audit_overflow')
          .select('hour');
        expect(asMember.error).toBeNull();
        expect(asMember.data).toEqual([]);

        const asAdmin = await adminClient
          .from('auth_audit_overflow')
          .select('hour')
          .gte('hour', recentHours());
        expect(asAdmin.error).toBeNull();
        expect(asAdmin.data?.length).toBeGreaterThan(0);

        const write = await memberClient
          .from('auth_audit_overflow')
          .insert({ hour: new Date().toISOString(), dropped: 1 });
        expect(write.error?.code).toBe('42501');
      });

      it('is pruned with the audit log at 90 days, and not before', async () => {
        // Inside a transaction that is rolled back, so the retention run touches nothing else.
        const db = new Client(DB);
        await db.connect();
        try {
          await db.query('begin');
          await db.query(
            `insert into auth_audit_overflow (hour, dropped) values
               (date_trunc('hour', now() - interval '91 days'), 3),
               (date_trunc('hour', now() - interval '89 days'), 4)
             on conflict (hour) do nothing`
          );
          await db.query('select cleanup_old_audit_logs()');
          const { rows } = await db.query(
            `select dropped from auth_audit_overflow
              where hour < now() - interval '88 days' order by hour`
          );
          expect(rows).toEqual([{ dropped: 4 }]);
        } finally {
          await db.query('rollback');
          await db.end();
        }
      });

      it('anon holds nothing on it and authenticated holds only SELECT', async () => {
        // Read from the catalog: Supabase's default ACL grants both roles everything on a new
        // table, and RLS does not gate TRUNCATE, so only the REVOKE makes this true.
        const db = new Client(DB);
        await db.connect();
        try {
          const { rows } = await db.query(
            `select grantee, privilege_type
               from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'auth_audit_overflow'
                and grantee in ('anon', 'authenticated')
              order by grantee, privilege_type`
          );
          expect(rows).toEqual([
            { grantee: 'authenticated', privilege_type: 'SELECT' },
          ]);
        } finally {
          await db.end();
        }
      });
    });
  }
);
