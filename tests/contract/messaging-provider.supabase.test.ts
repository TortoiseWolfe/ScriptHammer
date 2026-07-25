/**
 * Supabase runner for the shared messaging-provider conformance suite (#266).
 *
 * Creates the four fixture users, seeds the shared fixture graph via
 * `conformance-fixtures.ts` (identical to the .NET runner's, by construction),
 * then drives the REAL SupabaseMessagingProvider as per-user authenticated
 * clients. Gated on a live Supabase instance (`hasRlsTestEnvironment()`), so CI
 * shows it as skipped rather than silently absent.
 *
 * This is the live acceptance proof for the Step-2 extraction: the same queries,
 * now behind the provider, enforce the identical RLS contract on a real backend.
 *
 * @module tests/contract/messaging-provider.supabase.test
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { SupabaseMessagingProvider } from '@/services/messaging/providers/supabase-provider';
import type {
  AuthContext,
  MessagingDataProvider,
} from '@/services/messaging/providers';
import {
  createAuthenticatedClient,
  createServiceClient,
  createTestUser,
  hasRlsTestEnvironment,
} from '../fixtures/test-users';
import {
  seedConformanceFixtures,
  teardownConformanceFixtures,
} from './conformance-fixtures';
import {
  runMessagingProviderContract,
  type ConformanceHarness,
} from './messaging-provider.contract';

// Dedicated emails so this suite never collides with the RLS suite's userA/userB.
const EMAILS = {
  a: 'provider-contract-a@scripthammer.test',
  b: 'provider-contract-b@scripthammer.test',
  outsider: 'provider-contract-outsider@scripthammer.test',
  pending: 'provider-contract-pending@scripthammer.test',
} as const;
const PASSWORD = 'ContractPassword123!';

interface SupabaseHarness extends ConformanceHarness {
  svc: SupabaseClient<Database>;
}

async function buildProviderFor(
  email: string
): Promise<{ provider: MessagingDataProvider; ctx: AuthContext }> {
  const client = await createAuthenticatedClient(email, PASSWORD);
  const { data } = await client.auth.getSession();
  const session = data.session!;
  const provider = new SupabaseMessagingProvider(client);
  const ctx: AuthContext = {
    userId: session.user.id,
    accessToken: session.access_token,
  };
  return { provider, ctx };
}

if (!hasRlsTestEnvironment()) {
  // Register a visibly-skipped placeholder so the suite shows up in CI output.
  runMessagingProviderContract({
    providerName: 'supabase (skipped — no live Supabase)',
    setup: () => Promise.reject(new Error('unreachable')),
    teardown: () => Promise.resolve(),
  });
} else {
  runMessagingProviderContract({
    providerName: 'supabase',
    async setup(): Promise<SupabaseHarness> {
      const svc = createServiceClient();

      const userA = await createTestUser(EMAILS.a, PASSWORD);
      const userB = await createTestUser(EMAILS.b, PASSWORD);
      const outsider = await createTestUser(EMAILS.outsider, PASSWORD);
      const pending = await createTestUser(EMAILS.pending, PASSWORD);

      const fixtures = await seedConformanceFixtures(svc, {
        aId: userA.id,
        bId: userB.id,
        outsiderId: outsider.id,
        pendingId: pending.id,
      });

      const a = await buildProviderFor(EMAILS.a);
      const b = await buildProviderFor(EMAILS.b);
      const out = await buildProviderFor(EMAILS.outsider);

      return {
        svc,
        userAId: userA.id,
        userBId: userB.id,
        providerA: a.provider,
        ctxA: a.ctx,
        providerB: b.provider,
        ctxB: b.ctx,
        outsiderId: outsider.id,
        providerOutsider: out.provider,
        ctxOutsider: out.ctx,
        pendingUserId: pending.id,
        ...fixtures,
      };
    },

    async teardown(h: ConformanceHarness): Promise<void> {
      const { svc } = h as SupabaseHarness;
      await teardownConformanceFixtures(svc, h);
    },
  });
}
