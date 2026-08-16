/**
 * .NET runner for the shared messaging-provider conformance suite (#266/#265).
 *
 * Gated on `DOTNET_API_URL`. When set, it seeds through the SAME shared code the
 * Supabase runner uses (`conformance-fixtures.ts` — users + connections + 1:1 and
 * group conversations, written via the Supabase service client into the shared
 * Postgres), then drives the REAL DotnetMessagingProvider —
 * pointed at the live ASP.NET server — through the IDENTICAL contract assertions
 * (the 14 named clauses in `docs/messaging/AUTHORIZATION-CONTRACT.md`).
 * If the .NET backend drops a rule, this suite goes red. That is the whole point:
 * the contract is measured against both backends, not trusted.
 *
 * Requires the .NET server (docker compose --profile dotnet up) reading the same
 * Postgres the seeding writes to, and the SAME SUPABASE_JWT_SECRET so it can
 * validate the access tokens minted by the Supabase auth the seeding signs in
 * against. Run: DOTNET_API_URL=http://127.0.0.1:5099 pnpm test:rls
 *
 * @module tests/contract/messaging-provider.dotnet.test
 */

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { DotnetMessagingProvider } from '@/services/messaging/providers/dotnet-provider';
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

const DOTNET_API_URL = process.env.DOTNET_API_URL;

const EMAILS = {
  a: 'dotnet-contract-a@scripthammer.test',
  b: 'dotnet-contract-b@scripthammer.test',
  outsider: 'dotnet-contract-outsider@scripthammer.test',
  pending: 'dotnet-contract-pending@scripthammer.test',
} as const;
const PASSWORD = 'DotnetContract123!';

interface DotnetHarness extends ConformanceHarness {
  svc: SupabaseClient<Database>;
}

async function buildProviderFor(
  email: string,
  baseUrl: string
): Promise<{ provider: MessagingDataProvider; ctx: AuthContext }> {
  // Sign in via Supabase auth to mint a real access token; the .NET server
  // validates it with the same SUPABASE_JWT_SECRET.
  const client = await createAuthenticatedClient(email, PASSWORD);
  const { data } = await client.auth.getSession();
  const session = data.session!;
  const provider = new DotnetMessagingProvider(baseUrl);
  const ctx: AuthContext = {
    userId: session.user.id,
    accessToken: session.access_token,
  };
  return { provider, ctx };
}

if (!DOTNET_API_URL || !hasRlsTestEnvironment()) {
  // Visibly-skipped placeholder (dormant until DOTNET_API_URL points at a live
  // .NET server AND a live Supabase is configured to seed + mint tokens).
  describe.skip('MessagingDataProvider contract [dotnet]', () => {
    it('runs with DOTNET_API_URL + live Supabase (see dotnet-messaging/README.md)', () => {});
  });
} else {
  const baseUrl = DOTNET_API_URL;
  runMessagingProviderContract({
    providerName: 'dotnet',
    async setup(): Promise<DotnetHarness> {
      const svc = createServiceClient();

      const userA = await createTestUser(EMAILS.a, PASSWORD);
      const userB = await createTestUser(EMAILS.b, PASSWORD);
      const outsider = await createTestUser(EMAILS.outsider, PASSWORD);
      const pending = await createTestUser(EMAILS.pending, PASSWORD);

      // The SAME fixture graph the Supabase runner seeds — shared code, so the
      // two backends are measured against an identical world by construction.
      const fixtures = await seedConformanceFixtures(svc, {
        aId: userA.id,
        bId: userB.id,
        outsiderId: outsider.id,
        pendingId: pending.id,
      });

      const a = await buildProviderFor(EMAILS.a, baseUrl);
      const b = await buildProviderFor(EMAILS.b, baseUrl);
      const out = await buildProviderFor(EMAILS.outsider, baseUrl);

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
        // C30 (#352): the SAME helper the Supabase runner uses. The state under
        // test must be built identically on both backends, or a divergence in
        // the fixture would read as a divergence in enforcement.
        setAbConnection: (opts) => setConnection(svc, opts),
        ...fixtures,
      };
    },

    async teardown(h: ConformanceHarness): Promise<void> {
      const { svc } = h as DotnetHarness;
      await teardownConformanceFixtures(svc, h);
    },

    /**
     * The .NET server must refuse from its OWN authorization check, not by
     * letting Postgres RLS raise underneath it.
     *
     * This matters because the server currently talks to the same RLS-protected
     * Postgres as Supabase, which masks missing checks: a mutation test that
     * stubbed `MessagingQueries.HasAcceptedConnection` to always return true
     * left all 25 cases green — RLS rejected the INSERT (42501), the request
     * 500'd, the provider threw anyway, and no row was created. Every
     * row-based assertion still held while the explicit rule was GONE.
     *
     * #265's premise is that a .NET backend re-expresses each rule explicitly,
     * because the next backend may not have RLS underneath. So we pin the
     * status: 403 for an authorization refusal, 400 for invalid input, and
     * never a 5xx — `DotnetMessagingProvider.request` puts the status in the
     * ConnectionError message.
     */
    assertRefusal(error: unknown, kind): void {
      const message = String((error as Error | undefined)?.message ?? '');
      expect(message).toContain('failed:');
      const expected = kind === 'self' ? '400' : '403';
      expect(message).toContain(expected);
    },
  });
}
