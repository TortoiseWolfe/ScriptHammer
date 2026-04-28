/**
 * retryFailedPayment tests — covers the gaps that #43 actually closes:
 * idempotency-key reuse, retry cap (FR-009), cooling period (FR-010),
 * expiry guard, dedupe-conflict path, and audit-log emission (NFR-007).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  retryFailedPayment,
  PaymentRetryLimitError,
  PaymentRetryCoolingError,
  PaymentRetryExpiredError,
  RETRY_LIMIT,
  COOLING_PERIOD_MS,
} from '../payment-service';
import type { PaymentIntent } from '@/types/payment';

// ── Test fixtures ──────────────────────────────────────────────────────
const USER_ID = 'user-abc-123';

function makeParent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  const now = Date.now();
  return {
    id: 'parent-1',
    template_user_id: USER_ID,
    amount: 2000,
    currency: 'usd',
    type: 'one_time',
    interval: null,
    customer_email: 'test@example.com',
    description: null,
    metadata: null,
    idempotency_key: 'orig-key-xyz',
    retry_count: 0,
    parent_intent_id: null,
    created_at: new Date(now - COOLING_PERIOD_MS - 1000).toISOString(), // past cooling
    expires_at: new Date(now + 3_600_000).toISOString(), // 1h from now
    ...overrides,
  };
}

// ── Mock surface ───────────────────────────────────────────────────────
// Captures the upsert payload + onConflict options for assertions.
const upsertCalls: Array<{ payload: Record<string, unknown>; opts: unknown }> =
  [];
let parentIntent: PaymentIntent = makeParent();
let upsertResult: { data: unknown; error: unknown } = {
  data: { id: 'child-2' },
  error: null,
};
const auditCalls: Array<unknown> = [];

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: USER_ID }, access_token: 't' } },
          error: null,
        })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: parentIntent, error: null })
          ),
        })),
      })),
      upsert: vi.fn((payload: Record<string, unknown>, opts: unknown) => {
        upsertCalls.push({ payload, opts });
        return {
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve(upsertResult)),
          })),
        };
      }),
    })),
  },
  isSupabaseOnline: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/lib/payments/audit', () => ({
  logPaymentRetryEvent: vi.fn((params: unknown) => {
    auditCalls.push(params);
    return Promise.resolve();
  }),
}));

// ── Tests ──────────────────────────────────────────────────────────────
beforeEach(() => {
  upsertCalls.length = 0;
  auditCalls.length = 0;
  parentIntent = makeParent();
  upsertResult = { data: { id: 'child-2' }, error: null };
});

describe('retryFailedPayment — idempotency-key reuse (#43)', () => {
  it("reuses the parent's idempotency_key in the new intent", async () => {
    parentIntent = makeParent({ idempotency_key: 'shared-key-42' });
    await retryFailedPayment('parent-1');
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].payload.idempotency_key).toBe('shared-key-42');
  });

  it("uses upsert(onConflict: 'idempotency_key', ignoreDuplicates: true) so double-clicks dedupe server-side", async () => {
    await retryFailedPayment('parent-1');
    expect(upsertCalls[0].opts).toEqual({
      onConflict: 'idempotency_key',
      ignoreDuplicates: true,
    });
  });

  it('generates a fresh key only if parent has none (legacy intent)', async () => {
    parentIntent = makeParent({ idempotency_key: null });
    await retryFailedPayment('parent-1');
    const sent = upsertCalls[0].payload.idempotency_key as string;
    expect(sent).toMatch(/^[0-9a-f-]{36}$/i); // UUID
  });
});

describe('retryFailedPayment — retry cap (FR-009)', () => {
  it(`throws PaymentRetryLimitError when parent.retry_count >= ${RETRY_LIMIT}`, async () => {
    parentIntent = makeParent({ retry_count: RETRY_LIMIT });
    await expect(retryFailedPayment('parent-1')).rejects.toBeInstanceOf(
      PaymentRetryLimitError
    );
  });

  it(`allows retry when retry_count < ${RETRY_LIMIT}`, async () => {
    parentIntent = makeParent({ retry_count: RETRY_LIMIT - 1 });
    await expect(retryFailedPayment('parent-1')).resolves.toBeDefined();
  });

  it('writes the bumped retry_count to the new intent', async () => {
    parentIntent = makeParent({ retry_count: 1 });
    await retryFailedPayment('parent-1');
    expect(upsertCalls[0].payload.retry_count).toBe(2);
  });

  it('writes parent_intent_id linkage to the new intent', async () => {
    await retryFailedPayment('parent-1');
    expect(upsertCalls[0].payload.parent_intent_id).toBe('parent-1');
  });
});

describe('retryFailedPayment — cooling period (FR-010)', () => {
  it('throws PaymentRetryCoolingError when parent created within cooling window', async () => {
    parentIntent = makeParent({
      created_at: new Date(Date.now() - 1000).toISOString(), // 1s ago
    });
    await expect(retryFailedPayment('parent-1')).rejects.toBeInstanceOf(
      PaymentRetryCoolingError
    );
  });

  it('cooling error carries the remaining waitMs so UI can render countdown', async () => {
    parentIntent = makeParent({
      created_at: new Date(Date.now() - 5000).toISOString(),
    });
    try {
      await retryFailedPayment('parent-1');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PaymentRetryCoolingError);
      const waitMs = (err as PaymentRetryCoolingError).waitMs;
      expect(waitMs).toBeGreaterThan(0);
      expect(waitMs).toBeLessThanOrEqual(COOLING_PERIOD_MS);
    }
  });

  it('allows retry once cooling expires', async () => {
    parentIntent = makeParent({
      created_at: new Date(Date.now() - COOLING_PERIOD_MS - 100).toISOString(),
    });
    await expect(retryFailedPayment('parent-1')).resolves.toBeDefined();
  });
});

describe('retryFailedPayment — expiry guard', () => {
  it('throws PaymentRetryExpiredError when parent has expired', async () => {
    parentIntent = makeParent({
      expires_at: new Date(Date.now() - 1000).toISOString(), // expired 1s ago
    });
    await expect(retryFailedPayment('parent-1')).rejects.toBeInstanceOf(
      PaymentRetryExpiredError
    );
  });

  it('allows retry while parent is still within expiry window', async () => {
    parentIntent = makeParent({
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(retryFailedPayment('parent-1')).resolves.toBeDefined();
  });
});

describe('retryFailedPayment — dedupe-conflict path', () => {
  it('returns the parent intent when the upsert hits ON CONFLICT (no double-charge)', async () => {
    upsertResult = { data: null, error: null }; // ON CONFLICT DO NOTHING fired
    const result = await retryFailedPayment('parent-1');
    expect(result.id).toBe('parent-1');
  });

  it('records the conflict in the audit log so admins can see the dedupe', async () => {
    upsertResult = { data: null, error: null };
    await retryFailedPayment('parent-1');
    expect(auditCalls).toHaveLength(1);
    expect((auditCalls[0] as { deduped: boolean }).deduped).toBe(true);
  });
});

describe('retryFailedPayment — audit log (NFR-007)', () => {
  it('emits an audit event for every retry attempt', async () => {
    await retryFailedPayment('parent-1');
    expect(auditCalls).toHaveLength(1);
  });

  it('audit event carries retry_count, original/new intent ids, user id', async () => {
    parentIntent = makeParent({ retry_count: 1 });
    upsertResult = { data: { id: 'child-fresh-id' }, error: null };
    await retryFailedPayment('parent-1');
    const event = auditCalls[0] as Record<string, unknown>;
    expect(event.userId).toBe(USER_ID);
    expect(event.originalIntentId).toBe('parent-1');
    expect(event.newIntentId).toBe('child-fresh-id');
    expect(event.retryCount).toBe(2);
  });
});
