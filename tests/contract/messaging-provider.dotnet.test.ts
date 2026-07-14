/**
 * .NET runner for the shared messaging-provider conformance suite (#266/#265).
 *
 * Gated on `DOTNET_API_URL`. When set, it seeds the SAME way the Supabase runner
 * does (users + connection + 1:1 conversation via the Supabase service client
 * into the shared Postgres), then drives the REAL DotnetMessagingProvider —
 * pointed at the live ASP.NET server — through the IDENTICAL C1–C29 assertions.
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

import { describe, it } from 'vitest';
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
  deleteTestUser,
  hasRlsTestEnvironment,
} from '../fixtures/test-users';
import {
  runMessagingProviderContract,
  type ConformanceHarness,
} from './messaging-provider.contract';

const DOTNET_API_URL = process.env.DOTNET_API_URL;

const EMAILS = {
  a: 'dotnet-contract-a@scripthammer.test',
  b: 'dotnet-contract-b@scripthammer.test',
  outsider: 'dotnet-contract-outsider@scripthammer.test',
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

      const [p1, p2] =
        userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];

      await svc.from('user_connections').insert({
        requester_id: p1,
        addressee_id: p2,
        status: 'accepted',
      });

      const { data: conv, error: convErr } = await svc
        .from('conversations')
        .insert({
          participant_1_id: p1,
          participant_2_id: p2,
          is_group: false,
          current_key_version: 1,
        })
        .select()
        .single();
      if (convErr || !conv) {
        throw new Error(
          `Failed to seed conversation: ${convErr?.message ?? 'no row'}`
        );
      }
      const conversationId = conv.id;

      const a = await buildProviderFor(EMAILS.a, baseUrl);
      const b = await buildProviderFor(EMAILS.b, baseUrl);
      const out = await buildProviderFor(EMAILS.outsider, baseUrl);

      const seedMessage: ConformanceHarness['seedMessage'] = async ({
        senderId,
        ciphertext = 'c2VlZA==',
        createdAtIso,
      }) => {
        const row: Record<string, unknown> = {
          conversation_id: conversationId,
          sender_id: senderId,
          encrypted_content: ciphertext,
          initialization_vector: 'aXY=',
          sequence_number: 0, // trigger overrides
          key_version: 1,
        };
        if (createdAtIso) row.created_at = createdAtIso;
        const { data, error } = await svc
          .from('messages')
          .insert(row as never)
          .select('id')
          .single();
        if (error || !data) {
          throw new Error(`seedMessage failed: ${error?.message ?? 'no row'}`);
        }
        return { id: (data as { id: string }).id };
      };

      const readMessage: ConformanceHarness['readMessage'] = async (id) => {
        const { data } = await svc
          .from('messages')
          .select(
            'id, deleted, edited, encrypted_content, read_at, sequence_number'
          )
          .eq('id', id)
          .maybeSingle();
        return data ?? null;
      };

      return {
        svc,
        userAId: userA.id,
        userBId: userB.id,
        conversationId,
        providerA: a.provider,
        ctxA: a.ctx,
        providerB: b.provider,
        ctxB: b.ctx,
        outsiderId: outsider.id,
        providerOutsider: out.provider,
        ctxOutsider: out.ctx,
        seedMessage,
        readMessage,
      };
    },

    async teardown(h: ConformanceHarness): Promise<void> {
      const { svc } = h as DotnetHarness;
      await svc.from('conversations').delete().eq('id', h.conversationId);
      await svc
        .from('user_connections')
        .delete()
        .or(`requester_id.eq.${h.userAId},requester_id.eq.${h.userBId}`);
      await deleteTestUser(h.userAId).catch(() => {});
      await deleteTestUser(h.userBId).catch(() => {});
      await deleteTestUser(h.outsiderId).catch(() => {});
    },
  });
}
