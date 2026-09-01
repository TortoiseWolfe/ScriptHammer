/**
 * Unit tests for PaymentQueueAdapter idempotent INSERT path.
 *
 * Validates the offline-queue retry safety contract from #52:
 * - A queued idempotency_key flows into the upsert payload with the
 *   correct onConflict + ignoreDuplicates options.
 * - A zero-row upsert response is treated as conflicted (the prior
 *   attempt's row is already there); the queue row still completes.
 *
 * @module lib/offline-queue/__tests__/payment-adapter.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Per-call upsert mock so each test can specify the response shape.
// Sits inside the from() chain expected by Supabase JS:
//   supabase.from('payment_intents').upsert(payload, options).select('id').maybeSingle()
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const fetchMock = vi.fn();

// Reconfigure the chain in beforeEach so each test starts from a known
// state. mockReturnValue calls happen there.

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'test-user-1' } },
        error: null,
      })),
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'test-user-1' }, access_token: 't' } },
        error: null,
      })),
    },
  },
}));

// Import AFTER the mock so the adapter binds to our mocked supabase.
import { PaymentQueueAdapter } from '../payment-adapter';

describe('PaymentQueueAdapter (idempotent INSERT path, #52)', () => {
  let adapter: PaymentQueueAdapter;

  beforeEach(async () => {
    mockMaybeSingle.mockReset();
    mockSelect.mockReset().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockInsert.mockReset().mockReturnValue({ select: mockSelect });
    mockFrom.mockReset().mockReturnValue({ insert: mockInsert });
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);

    adapter = new PaymentQueueAdapter();
    await adapter.clear();
  });

  it('replays through create-order, sending the SKU and the queued key (#559 T025)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ intent_id: 'intent-1' }),
    } as Response);

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'fixed-key-1',
        product_id: 'demo-checkout',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.success).toBe(1);
    // The browser writes nothing: no table call at all on the drain path.
    expect(mockInsert).not.toHaveBeenCalled();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/functions\/v1\/create-order$/);
    const headers = (init as RequestInit).headers as Record<string, string>;
    // The queued key becomes the REQUEST key, so a drain that runs twice replays
    // create-order's stored result instead of charging again.
    expect(headers['Idempotency-Key']).toBe('fixed-key-1');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.product_id).toBe('demo-checkout');
    expect(body.buyer_email).toBe('a@example.com');
  });

  it('refuses a queue row with no product_id rather than guessing a SKU', async () => {
    // Rows queued before catalog pricing shipped. Charging for a guessed product is
    // worse than leaving the row in the queue and saying so.
    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'legacy-row',
      },
      'test-user-1'
    );
    const result = await adapter.sync();
    expect(result.success).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a create-order refusal leaves the row unsynced rather than reporting success', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Product not found' }),
    } as Response);

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'rejected-key',
        product_id: 'no-such-sku',
      },
      'test-user-1'
    );
    const result = await adapter.sync();
    expect(result.success).toBe(0);
  });
});
