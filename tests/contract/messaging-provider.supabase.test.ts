/**
 * Supabase runner for the shared messaging-provider conformance suite (#266).
 *
 * Seeds two participants + an outsider + an accepted connection + a 1:1
 * conversation via the service client, then drives the REAL
 * SupabaseMessagingProvider as per-user authenticated clients. Gated on a live
 * Supabase instance (`hasRlsTestEnvironment()`), so CI shows it as skipped
 * rather than silently absent.
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
  deleteTestUser,
  hasRlsTestEnvironment,
} from '../fixtures/test-users';
import {
  runMessagingProviderContract,
  type ConformanceHarness,
} from './messaging-provider.contract';

// Dedicated emails so this suite never collides with the RLS suite's userA/userB.
const EMAILS = {
  a: 'provider-contract-a@scripthammer.test',
  b: 'provider-contract-b@scripthammer.test',
  outsider: 'provider-contract-outsider@scripthammer.test',
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

      // Canonical ordering constraint: participant_1_id < participant_2_id.
      const [p1, p2] =
        userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];

      // An accepted connection is required to create a 1:1 conversation (C3).
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

      const a = await buildProviderFor(EMAILS.a);
      const b = await buildProviderFor(EMAILS.b);
      const out = await buildProviderFor(EMAILS.outsider);

      // Direct seed/read helpers via the service client (bypass RLS + control
      // created_at / sequence so we can exercise the rules against known rows).
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
      const { svc } = h as SupabaseHarness;
      // Cascade: deleting the conversation drops its messages; then the users.
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
