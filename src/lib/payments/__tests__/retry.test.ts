/**
 * retryFailedPayment — the CONTRACT, after the write moved server-side (#559, #1046).
 *
 * WHAT THIS FILE USED TO DO, AND WHY IT WAS WORSE THAN NOTHING. It asserted the
 * upsert's payload and its `{ onConflict: 'idempotency_key', ignoreDuplicates: true }`
 * options against a mocked Supabase client whose `upsertResult` was hardcoded to
 * `{ data: { id: 'child-2' } }`. Every assertion passed. Meanwhile the real statement
 * could not execute at all: PostgREST emits a bare `ON CONFLICT (idempotency_key)`,
 * the index is PARTIAL, and Postgres refuses to infer a partial index without its
 * predicate — HTTP 400, SQLSTATE 42P10, for every call including ones with nothing to
 * conflict with. A suite that pins the shape of a statement the database rejects is a
 * suite that guards the bug.
 *
 * So this now tests the CONTRACT the caller depends on — which refusal becomes which
 * typed error, what gets audited, what comes back — and the guards themselves are
 * tested where they now live, in tests/unit/create-order-retry.test.ts, against pure
 * functions CI can actually reach.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  retryFailedPayment,
  PaymentRetryLimitError,
  PaymentRetryCoolingError,
  PaymentRetryExpiredError,
} from '@/lib/payments/payment-service';

const USER_ID = 'user-1';
const PARENT_ID = 'intent-parent';
const CHILD_ID = 'intent-child';

const auditCalls: Array<Record<string, unknown>> = [];
let sessionToken: string | null = 't';
let intentRow: Record<string, unknown> | null = { id: CHILD_ID };

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: sessionToken
              ? { user: { id: USER_ID }, access_token: sessionToken }
              : null,
          },
          error: null,
        })
      ),
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: USER_ID } }, error: null })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: intentRow,
              error: intentRow ? null : { message: 'not found' },
            })
          ),
        })),
      })),
    })),
  },
  isSupabaseOnline: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/lib/payments/audit', () => ({
  logPaymentRetryEvent: vi.fn((params: Record<string, unknown>) => {
    auditCalls.push(params);
    return Promise.resolve();
  }),
}));

/** The create-order response for one call. */
function respond(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

const fetchMock = vi.fn();
beforeEach(() => {
  auditCalls.length = 0;
  sessionToken = 't';
  intentRow = { id: CHILD_ID };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('retryFailedPayment — what it sends', () => {
  it('POSTs op:retry with the intent id, and never an amount', async () => {
    fetchMock.mockReturnValue(
      respond(200, { intent_id: CHILD_ID, retry_count: 1, deduped: false })
    );
    await retryFailedPayment(PARENT_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/functions\/v1\/create-order$/);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ op: 'retry', intent_id: PARENT_ID });
    // The price is the parent's, resolved server-side. A client that could name an
    // amount here would be the hole #559 exists to close.
    expect(body).not.toHaveProperty('amount');
  });

  it('sends the session bearer token', async () => {
    fetchMock.mockReturnValue(respond(200, { intent_id: CHILD_ID }));
    await retryFailedPayment(PARENT_ID);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer t'
    );
  });

  it('refuses without a session rather than calling the function', async () => {
    // getAuthenticatedUserId() refuses first, with its own wording. What matters for
    // this contract is that no unauthenticated request reaches create-order at all —
    // the message belongs to that helper and is not pinned here.
    sessionToken = null;
    await expect(retryFailedPayment(PARENT_ID)).rejects.toThrow(
      /authentication required|signed in/i
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('retryFailedPayment — refusals map to typed errors', () => {
  // PaymentStatusDisplay branches on these classes to choose its message, so
  // collapsing them into one generic Error would silently degrade the UI.
  it('retry_limit -> PaymentRetryLimitError', async () => {
    fetchMock.mockReturnValue(
      respond(429, { code: 'retry_limit', retry_count: 3, error: 'capped' })
    );
    await expect(retryFailedPayment(PARENT_ID)).rejects.toBeInstanceOf(
      PaymentRetryLimitError
    );
  });

  it('retry_cooling -> PaymentRetryCoolingError carrying waitMs for the countdown', async () => {
    fetchMock.mockReturnValue(
      respond(429, { code: 'retry_cooling', wait_ms: 12_000, error: 'wait' })
    );
    await expect(retryFailedPayment(PARENT_ID)).rejects.toMatchObject({
      name: 'PaymentRetryCoolingError',
      waitMs: 12_000,
    });
  });

  it('retry_expired -> PaymentRetryExpiredError', async () => {
    fetchMock.mockReturnValue(
      respond(410, { code: 'retry_expired', error: 'expired' })
    );
    await expect(retryFailedPayment(PARENT_ID)).rejects.toBeInstanceOf(
      PaymentRetryExpiredError
    );
  });

  it('an unrecognised refusal still throws, with the server message', async () => {
    fetchMock.mockReturnValue(
      respond(500, { error: 'Could not create retry' })
    );
    await expect(retryFailedPayment(PARENT_ID)).rejects.toThrow(
      'Could not create retry'
    );
  });

  it('a refusal with an unparseable body still throws', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      } as unknown as Response)
    );
    await expect(retryFailedPayment(PARENT_ID)).rejects.toThrow();
  });
});

describe('retryFailedPayment — success and dedupe', () => {
  it('returns the new intent row', async () => {
    fetchMock.mockReturnValue(
      respond(200, { intent_id: CHILD_ID, retry_count: 1, deduped: false })
    );
    await expect(retryFailedPayment(PARENT_ID)).resolves.toMatchObject({
      id: CHILD_ID,
    });
  });

  it('audits the attempt with the new intent id', async () => {
    fetchMock.mockReturnValue(
      respond(200, { intent_id: CHILD_ID, retry_count: 2, deduped: false })
    );
    await retryFailedPayment(PARENT_ID);
    expect(auditCalls[0]).toMatchObject({
      originalIntentId: PARENT_ID,
      newIntentId: CHILD_ID,
      retryCount: 2,
      deduped: false,
    });
  });

  it('a deduped retry audits newIntentId: null — nothing new was created', async () => {
    // The deterministic child key means a double-submitted Retry hits 23505 server-side
    // and reports the row that already won. Auditing a new id there would claim a
    // second attempt that never happened.
    fetchMock.mockReturnValue(
      respond(200, { intent_id: CHILD_ID, retry_count: 1, deduped: true })
    );
    await retryFailedPayment(PARENT_ID);
    expect(auditCalls[0]).toMatchObject({ deduped: true, newIntentId: null });
  });

  it('throws if the intent cannot be read back, rather than returning a hollow object', async () => {
    fetchMock.mockReturnValue(respond(200, { intent_id: CHILD_ID }));
    intentRow = null;
    await expect(retryFailedPayment(PARENT_ID)).rejects.toThrow(
      /could not be read back/i
    );
  });
});
