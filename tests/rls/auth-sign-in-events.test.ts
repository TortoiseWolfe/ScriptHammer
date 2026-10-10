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
 * The row now comes from a trigger on `auth.users.last_sign_in_at`, which GoTrue sets when it
 * issues a new session and which no client can write. These tests sign in for real, against
 * real GoTrue, so they pin GoTrue's behaviour as well as ours: if a token refresh ever started
 * touching `last_sign_in_at`, the refresh test is what would say so.
 *
 * Anonymous telemetry (failed sign-ins, reset requests) stays client-written, because nothing
 * server-side sees a failed password. What changes is that it is bounded: a smaller payload,
 * and a site-wide hourly ceiling, since a caller with no session cannot be told apart from
 * another one.
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
    });

    afterAll(async () => {
      await service
        .from('auth_audit_logs')
        .delete()
        .eq('event_data->>marker', marker);
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

      it('anonymous rows stop at a site-wide hourly ceiling, and service_role is exempt', async () => {
        const anon = createAnonClient();
        await clearAnonMarkerRows();
        await fillAnonRowsTo(ANON_HOURLY_CEILING);
        const atCeiling = await anonRowsThisHour();
        expect(atCeiling).toBe(ANON_HOURLY_CEILING);

        const refused = await anon.rpc('log_auth_event', {
          p_event_type: 'sign_in_failed',
          p_event_data: { marker },
          p_success: false,
        });
        expect(refused.error?.code).toBe('54000');
        expect(await anonRowsThisHour()).toBe(atCeiling);

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

      it('two callers overlapping at the last slot: the second waits for the first, then is refused', async () => {
        // Without the lock, the second caller counts 29 while the first has not committed, and
        // both write. A first draft raced eight PostgREST calls at once instead; it stayed green
        // with the lock deleted, because nothing made them overlap. This makes them.
        await clearAnonMarkerRows();
        await fillAnonRowsTo(ANON_HOURLY_CEILING - 1);
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
          await caller.query('rollback');
          expect(err?.code).toBe('54000');
          expect(await anonRowsThisHour()).toBe(ANON_HOURLY_CEILING);
        } finally {
          await holder.end();
          await caller.end();
          await clearAnonMarkerRows();
        }
      });
    });
  }
);
