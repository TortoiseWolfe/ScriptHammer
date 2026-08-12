/**
 * SupabaseMessagingProvider C3 refusal preflight tests (#505).
 *
 * RLS is the authorization boundary, but the provider has a separate
 * preflight that turns refused conversation creates into stable domain errors
 * for the UI. These tests deliberately provide an RLS-shaped no-row INSERT
 * fallback: deleting that preflight could still throw the same ConnectionError,
 * so asserting that `insert` was never reached is the regression detector.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { ConnectionError, ValidationError } from '@/types/messaging';
import { SupabaseMessagingProvider } from '../supabase-provider';

const USER_A = '00000000-0000-0000-0000-000000000001';
const USER_B = '00000000-0000-0000-0000-000000000002';

function emptyConversationLookup() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function connectionPreflight(state: 'missing' | 'pending') {
  let requestedStatus: string | undefined;
  const query = {
    select: vi.fn(),
    or: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.eq.mockImplementation((column: string, value: string) => {
    if (column === 'status') requestedStatus = value;
    return query;
  });
  query.maybeSingle.mockImplementation(async () => ({
    // The actual PostgREST query filters `status = accepted`, so a pending row
    // is indistinguishable from a missing one at this boundary. If that filter
    // is removed, expose the pending row to make the test fail closed.
    data:
      state === 'pending' && requestedStatus !== 'accepted'
        ? { status: 'pending' }
        : null,
    error: null,
  }));
  return query;
}

function rlsRejectedInsert() {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

function providerWithNoAcceptedConnection(state: 'missing' | 'pending') {
  const existingConversation = emptyConversationLookup();
  const connection = connectionPreflight(state);
  const deniedInsert = rlsRejectedInsert();
  let conversationQueries = 0;
  const from = vi.fn((table: string) => {
    if (table === 'user_connections') return connection;
    if (table === 'conversations') {
      conversationQueries += 1;
      return conversationQueries === 1 ? existingConversation : deniedInsert;
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    provider: new SupabaseMessagingProvider({
      from,
    } as unknown as SupabaseClient<Database>),
    from,
    connection,
    deniedInsert,
  };
}

describe('SupabaseMessagingProvider C3 refusal preflight (#505)', () => {
  it('rejects a self-conversation with the deterministic ValidationError before querying', async () => {
    const { provider, from } = providerWithNoAcceptedConnection('missing');
    const refusal = provider.getOrCreateConversation(
      { userId: USER_A, accessToken: 'token' },
      USER_A
    );

    await expect(refusal).rejects.toEqual(
      expect.objectContaining({
        name: 'ValidationError',
        message: 'You cannot start a conversation with yourself',
        field: 'otherUserId',
      })
    );
    await expect(refusal).rejects.toBeInstanceOf(ValidationError);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(['missing', 'pending'] as const)(
    'rejects a %s connection with the domain error before attempting an insert',
    async (state) => {
      const { provider, from, connection, deniedInsert } =
        providerWithNoAcceptedConnection(state);
      const refusal = provider.getOrCreateConversation(
        { userId: USER_A, accessToken: 'token' },
        USER_B
      );

      await expect(refusal).rejects.toEqual(
        expect.objectContaining({
          name: 'ConnectionError',
          message:
            'You must be connected with this user to start a conversation',
        })
      );
      await expect(refusal).rejects.toBeInstanceOf(ConnectionError);

      // A pending row is invisible after the production `status = accepted`
      // filter, so it must follow the same no-accepted-connection branch as a
      // missing row. Pin the predicate so the test cannot pass on any status.
      expect(connection.eq).toHaveBeenCalledWith('status', 'accepted');
      expect(from.mock.calls.map(([table]) => table)).toEqual([
        'conversations',
        'user_connections',
      ]);

      // Negative control: without the preflight, the supplied RLS-shaped
      // fallback still produces the same ConnectionError. This assertion is
      // what makes removal of the preflight turn the test red.
      expect(deniedInsert.insert).not.toHaveBeenCalled();
    }
  );
});
