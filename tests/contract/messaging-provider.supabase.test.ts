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

import { expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { SupabaseMessagingProvider } from '@/services/messaging/providers/supabase-provider';
import { ConnectionError, ValidationError } from '@/types/messaging';
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
  setConnection,
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
    assertRefusal: () => {
      throw new Error('unreachable: Supabase conformance suite is skipped');
    },
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
        // C30 (#352): both runners write the connection row through the same
        // service-client helper, so "blocked" means the same state on both
        // backends and only the ENFORCEMENT differs.
        setAbConnection: (opts) => setConnection(svc, opts),
        ...fixtures,
      };
    },

    async teardown(h: ConformanceHarness): Promise<void> {
      const { svc } = h as SupabaseHarness;
      await teardownConformanceFixtures(svc, h);
    },

    /**
     * RLS remains the security boundary, but the provider must refuse C3
     * requests before an INSERT reaches it so the UI gets a stable, actionable
     * domain error. The focused provider test also pins that preflight call
     * order; this live assertion verifies the public error contract.
     */
    assertRefusal(error: unknown, kind): void {
      if (kind === 'self') {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as Error).message).toBe(
          'You cannot start a conversation with yourself'
        );
        return;
      }

      if (kind === 'blocked') {
        // C30 (#352) is refused at the INSERT by RLS, not by a provider
        // preflight — there is no client-side connection check on the send path,
        // and adding one would only be advisory anyway.
        //
        // PostgREST maps a policy violation (42501) to HTTP 403, which is the
        // same status the .NET runner pins, so both backends refuse a block with
        // an authorization error rather than a 5xx. What must NOT appear is any
        // hint of WHY (asserted provider-agnostically in the contract).
        expect(error).toBeInstanceOf(ConnectionError);
        expect((error as Error).message).toContain('Failed to send message');
        expect((error as Error).message).toMatch(/row-level security/i);
        return;
      }

      expect(error).toBeInstanceOf(ConnectionError);
      expect((error as Error).message).toBe(
        'You must be connected with this user to start a conversation'
      );
    },
  });
}
