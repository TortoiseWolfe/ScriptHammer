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

    adapter = new PaymentQueueAdapter();
    await adapter.clear();
  });

  it('flows the queued idempotency_key into a plain INSERT (#1046)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'intent-1' },
      error: null,
    });

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'fixed-key-1',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.success).toBe(1);
    expect(result.conflicted).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith('payment_intents');

    // The insert must carry the queued key. It is a plain INSERT with NO conflict
    // target: PostgREST turns `onConflict` into a bare ON CONFLICT (col), which cannot
    // infer the PARTIAL unique index and made every drain fail with 42P10 (#1046).
    const [payload, ...rest] = mockInsert.mock.calls[0];
    expect(payload.idempotency_key).toBe('fixed-key-1');
    expect(payload.amount).toBe(1000);
    expect(payload.template_user_id).toBe('test-user-1');
    expect(rest).toEqual([]);
  });

  it('treats a 23505 as conflicted — a previous drain already did this work', async () => {
    // The unique index refuses the duplicate key. That is the dedupe the old
    // ignoreDuplicates was asking for, arriving as an error instead of a null row.
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'already-inserted-key',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.success).toBe(0);
    expect(result.conflicted).toBe(1);
    expect(result.failed).toBe(0);

    // The queue row is marked completed even though the dedupe path
    // fired — the user's work is done from their perspective.
    const all = await adapter.getQueue();
    expect(all[0].status).toBe('completed');
  });
});
