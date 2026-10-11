/**
 * stripe_checkout_sessions: the record create-stripe-checkout keeps of the sessions it opened, so
 * the next one can expire them (#1345). Nothing a client runs reads or writes it.
 *
 * Read from the catalog, because Supabase's default ACL grants anon and authenticated everything
 * on a new table, and RLS does not gate TRUNCATE: only the REVOKE makes "no client access" true.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createAuthenticatedClient,
  createServiceClient,
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

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: stripe_checkout_sessions is the server's alone (#1345) [${RLS_SKIP_REASON}]`,
  () => {
    let member: TestUser;
    let memberClient: SupabaseClient;
    let service: SupabaseClient;
    let intentId: string;
    const sessionId = `cs_test_1345_${Date.now()}`;

    beforeAll(async () => {
      service = createServiceClient();
      member = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      memberClient = await createAuthenticatedClient(
        member.email,
        member.password
      );
      const { data, error } = await service
        .from('payment_intents')
        .insert({
          template_user_id: member.id,
          amount: 1000,
          currency: 'usd',
          type: 'one_time',
          customer_email: member.email,
        })
        .select('id')
        .single();
      if (error)
        throw new Error(`could not create an intent: ${error.message}`);
      intentId = data.id;
    });

    afterAll(async () => {
      if (member) await deleteTestUser(member.id);
    });

    it('anon and authenticated hold no privilege on it at all', async () => {
      const db = new Client(DB);
      await db.connect();
      try {
        const { rows } = await db.query(
          `select grantee, privilege_type from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'stripe_checkout_sessions'
              and grantee in ('anon', 'authenticated')`
        );
        expect(rows).toEqual([]);
        const rls = await db.query(
          `select relrowsecurity from pg_class
            where relname = 'stripe_checkout_sessions' and relnamespace = 'public'::regnamespace`
        );
        // Anti-vacuity: an empty grant list on a table that does not exist proves nothing.
        expect(rls.rows).toEqual([{ relrowsecurity: true }]);
      } finally {
        await db.end();
      }
    });

    it('the service role records a session and reads it back by intent', async () => {
      const ins = await service
        .from('stripe_checkout_sessions')
        .insert({ session_id: sessionId, intent_id: intentId });
      expect(ins.error).toBeNull();
      const { data, error } = await service
        .from('stripe_checkout_sessions')
        .select('session_id')
        .in('intent_id', [intentId]);
      expect(error).toBeNull();
      expect(data).toEqual([{ session_id: sessionId }]);
    });

    it('a signed-in user can neither read nor write it', async () => {
      const read = await memberClient
        .from('stripe_checkout_sessions')
        .select('session_id');
      expect(read.error?.code).toBe('42501');
      const write = await memberClient
        .from('stripe_checkout_sessions')
        .insert({ session_id: `${sessionId}_x`, intent_id: intentId });
      expect(write.error?.code).toBe('42501');
    });

    it('goes with its intent: deleting the intent deletes the record', async () => {
      const del = await service
        .from('payment_intents')
        .delete()
        .eq('id', intentId);
      expect(del.error).toBeNull();
      const { data } = await service
        .from('stripe_checkout_sessions')
        .select('session_id')
        .eq('session_id', sessionId);
      expect(data).toEqual([]);
    });
  }
);
