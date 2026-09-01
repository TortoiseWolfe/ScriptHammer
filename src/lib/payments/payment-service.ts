/**
 * Payment Service
 * High-level API for payment operations with offline support
 */

import { supabase, isSupabaseOnline } from '@/lib/supabase/client';
import { queueOperation } from './offline-queue';
import type { Json } from '@/lib/supabase/types';
import type {
  CreatePaymentIntentInput,
  PaymentIntent,
  PaymentResult,
  PaymentActivity,
  Currency,
  PaymentType,
  PaymentInterval,
} from '@/types/payment';
import { validatePaymentAmount, validateCurrency } from '@/config/payment';
import { validateAndSanitizeMetadata } from './metadata-validator';
import { logPaymentRetryEvent } from './audit';

/**
 * Maximum retry attempts per payment chain (FR-009).
 * The CHECK is on the *parent's* `retry_count` — when retry_count of the
 * intent the user is retrying reaches this value, no further retry is
 * allowed. The first retry produces a child with retry_count=1; the second,
 * 2; the third, 3. The fourth click trips the cap.
 */
export const RETRY_LIMIT = 3;

/**
 * Cooling period between retries (FR-010). Measured from the parent
 * intent's `created_at`. Picked to be long enough to prevent trivial
 * mistype-and-spam loops, short enough not to feel punitive.
 */
export const COOLING_PERIOD_MS = 30_000;

/**
 * Thrown by `retryFailedPayment` when the parent intent has already been
 * retried `RETRY_LIMIT` times. UI should hide the retry button and surface
 * the support contact path.
 */
export class PaymentRetryLimitError extends Error {
  readonly attempts: number;
  readonly limit: number;
  constructor(attempts: number, limit: number) {
    super(`This payment has reached the maximum of ${limit} retry attempts.`);
    this.name = 'PaymentRetryLimitError';
    this.attempts = attempts;
    this.limit = limit;
  }
}

/**
 * Thrown by `retryFailedPayment` when the parent intent was created less
 * than `COOLING_PERIOD_MS` ago. Carries the remaining wait so the UI can
 * render a countdown (FR-010).
 */
export class PaymentRetryCoolingError extends Error {
  readonly waitMs: number;
  constructor(waitMs: number) {
    super(`Please wait ${Math.ceil(waitMs / 1000)}s before retrying.`);
    this.name = 'PaymentRetryCoolingError';
    this.waitMs = waitMs;
  }
}

/**
 * Thrown by `retryFailedPayment` when the parent intent has passed its
 * 24-hour expiry. The provider's session is gone; a same-key retry would
 * succeed at the DB but fail at the provider redirect. Better to refuse
 * here with a clear message than to surface a confusing failure later.
 */
export class PaymentRetryExpiredError extends Error {
  constructor() {
    super('This payment session has expired. Please start a new payment.');
    this.name = 'PaymentRetryExpiredError';
  }
}

/**
 * Get authenticated user ID
 * @throws Error if user not authenticated
 *
 * Uses getSession() instead of getUser() to avoid a server round-trip.
 * getUser() validates the JWT against /auth/v1/user, which under CI
 * shard load can 403 and cause supabase-js to emit a spurious SIGNED_OUT
 * event. That wiped AuthContext.user mid-render and unmounted the
 * payment-demo Step 4 block (gated on user?.id), flaking payment-isolation
 * tests. The RLS policies on payment tables still validate the JWT from
 * the access token, so we do not lose enforcement by skipping the server
 * round-trip here.
 */
async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session?.user) {
    throw new Error('Authentication required for payment operations');
  }

  return session.user.id;
}

/**
 * Create a payment intent
 * Queues operation if offline
 * REQ-SEC-001: Requires authentication, uses RLS for data isolation
 */
export async function createPaymentIntent(
  amount: number,
  currency: Currency,
  type: PaymentType,
  customerEmail: string,
  options?: {
    interval?: PaymentInterval;
    description?: string;
    metadata?: Record<string, unknown>;
    /**
     * Link to the original payment intent when this intent is created as
     * part of a recovery flow (provider switch after a decline). Preserves
     * the audit chain across providers without changing the offline-queue
     * path. Optional; omitted for normal first-attempt payments.
     */
    parent_intent_id?: string;
    /**
     * Catalog SKU. REQUIRED (#559 T025).
     *
     * The browser no longer writes payment_intents, so the price has to resolve from
     * `products` server-side. `amount` above is now a REQUEST, honoured only for a
     * SKU whose `amount_mode` is 'variable' and only inside its min/max — a fixed SKU
     * ignores it entirely. That is the whole point: an amount the browser names is an
     * amount the buyer can choose.
     */
    product_id?: string;
  }
): Promise<PaymentIntent> {
  // Require authentication (REQ-SEC-001)
  const userId = await getAuthenticatedUserId();

  // Validate inputs
  validatePaymentAmount(amount);
  validateCurrency(currency);

  // The catalog SKU is how the server prices this (#559 T025). Refusing here, loudly,
  // beats letting the request reach create-order and come back as a generic 400.
  const productId = options?.product_id?.trim();
  if (!productId) {
    throw new Error(
      'A product_id is required to start a payment — the price resolves from the catalog'
    );
  }

  // Sanitize email (prevent injection, normalize for deduplication)
  const sanitizedEmail = customerEmail.trim().toLowerCase();
  if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    throw new Error('Invalid email address');
  }

  // Validate metadata (REQ-SEC-005: prevent prototype pollution and resource exhaustion)
  let sanitizedMetadata: Record<string, unknown> = {};
  if (options?.metadata) {
    try {
      // validateAndSanitizeMetadata throws on validation error and returns sanitized metadata
      sanitizedMetadata = validateAndSanitizeMetadata(options.metadata);
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Invalid metadata'
      );
    }
  }

  const intentData: CreatePaymentIntentInput = {
    amount,
    currency,
    type,
    customer_email: sanitizedEmail,
    interval: options?.interval,
    description: options?.description,
    metadata: sanitizedMetadata,
    product_id: productId,
  };

  // Check if online
  const isOnline = await isSupabaseOnline();

  if (!isOnline) {
    // Queue for later. product_id rides along so the drain can replay this through
    // create-order rather than writing the row itself (#559 T025).
    await queueOperation('payment_intent', intentData, userId);
    throw new Error(
      'You are offline. Payment has been queued and will be processed when connection returns.'
    );
  }

  try {
    // SERVER-SIDE (#559 T025). This was a direct .insert() into payment_intents, which
    // meant the browser chose `amount`, `currency`, `type` and `parent_intent_id` and
    // RLS had nothing to say about any of them — RLS restricts ROWS, never COLUMNS, so
    // `WITH CHECK (auth.uid() = template_user_id)` only ever checked whose row it was,
    // never what was in it. create-order resolves the price from the catalog instead.
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error('You must be signed in to start a payment');

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: productId,
          buyer_email: sanitizedEmail,
          // A REQUEST, not an instruction. create-order honours it only for a
          // variable-amount SKU and only within that row's min/max bounds.
          amount,
        }),
      }
    );
    const payload = (await res.json().catch(() => ({}))) as {
      intent_id?: string;
      error?: string;
    };
    if (!res.ok || !payload.intent_id) {
      throw new Error(payload.error || 'Could not start this payment');
    }

    // SELECT is still granted to the browser; only INSERT is going away (T027).
    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', payload.intent_id)
      .single();

    if (error) throw error;
    return data as PaymentIntent;
  } catch (error) {
    // If network error, queue it
    if (
      error instanceof Error &&
      (error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED'))
    ) {
      await queueOperation('payment_intent', intentData, userId);
      throw new Error(
        'Network error. Payment has been queued and will be processed when connection returns.'
      );
    }
    throw error;
  }
}

/**
 * Get payment status by intent ID
 * REQ-SEC-001: Requires authentication, RLS ensures user owns the intent
 */
export async function getPaymentStatus(
  intentId: string
): Promise<PaymentResult | null> {
  // Require authentication (REQ-SEC-001)
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('payment_results')
    .select('*')
    .eq('intent_id', intentId)
    .maybeSingle();

  if (error) throw error;
  return data as PaymentResult | null;
}

/**
 * Get payment history for authenticated user
 * REQ-SEC-001: Uses authenticated user ID, protected by RLS
 */
export async function getPaymentHistory(
  limit = 20
): Promise<PaymentActivity[]> {
  // Require authentication (REQ-SEC-001)
  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('payment_results')
    .select(
      `
      id,
      provider,
      transaction_id,
      status,
      charged_amount,
      charged_currency,
      webhook_verified,
      created_at,
      intent:payment_intents!inner(customer_email)
    `
    )
    .eq('payment_intents.template_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.map((item) => ({
    id: item.id,
    provider: item.provider as PaymentActivity['provider'],
    transaction_id: item.transaction_id,
    status: item.status as PaymentActivity['status'],
    charged_amount: item.charged_amount ?? 0,
    charged_currency: item.charged_currency as Currency,
    customer_email: (item.intent as { customer_email: string }).customer_email,
    webhook_verified: item.webhook_verified,
    created_at: item.created_at,
  }));
}

/**
 * Retry a failed payment (#43, B1).
 *
 * Creates a new INSERT-only payment_intent row that:
 *   - reuses the parent's `idempotency_key` so the partial unique index
 *     turns a server-side race (double-click, two tabs) into a no-op
 *     instead of a duplicate charge — same pattern as the offline-queue
 *     adapter (`src/lib/offline-queue/payment-adapter.ts:165-195`)
 *   - links to the parent via `parent_intent_id`
 *   - bumps `retry_count` so the cap (FR-009) is enforced on the next click
 *
 * Refuses to proceed when:
 *   - parent.retry_count >= RETRY_LIMIT (FR-009) → PaymentRetryLimitError
 *   - parent created within COOLING_PERIOD_MS (FR-010) → PaymentRetryCoolingError
 *   - parent has passed its 24h expiry → PaymentRetryExpiredError
 *
 * Audit-logs every attempt to `auth_audit_logs` as `payment_retry` (NFR-007).
 *
 * REQ-SEC-001: requires authentication; RLS's "Users can create own payment
 * intents" policy ensures `template_user_id = auth.uid()`. The "Payment
 * intents are immutable" UPDATE policy means we never mutate the parent —
 * `retry_count` is only ever set on the new (child) row at INSERT time.
 */
export async function retryFailedPayment(
  intentId: string
): Promise<PaymentIntent> {
  const userId = await getAuthenticatedUserId();

  // SERVER-SIDE NOW (#559 T025, #1046). This used to fetch the parent, check the
  // cap/cooling/expiry guards here, and upsert the child straight into
  // payment_intents. It could not work, in two independent ways:
  //
  //   1. `{ onConflict: 'idempotency_key' }` becomes a bare ON CONFLICT
  //      (idempotency_key) at PostgREST. The index is PARTIAL
  //      (WHERE idempotency_key IS NOT NULL) and Postgres will not infer a partial
  //      index without its predicate, so EVERY call returned HTTP 400 / 42P10 and
  //      wrote nothing — not just conflicting ones.
  //   2. The child was given the PARENT's idempotency_key, so once inference was
  //      fixed it collided with its own parent and DO NOTHING swallowed it.
  //
  // Neither is expressible from the browser, because PostgREST has no syntax for the
  // index predicate. The guards also belonged on the server regardless: a cap the
  // client checks is a cap the client can skip.
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to retry a payment');
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ op: 'retry', intent_id: intentId }),
    }
  );

  const payload = (await res.json().catch(() => ({}))) as {
    intent_id?: string;
    retry_count?: number;
    deduped?: boolean;
    error?: string;
    code?: string;
    wait_ms?: number;
  };

  if (!res.ok) {
    // The typed errors are part of this function's contract — PaymentStatusDisplay
    // branches on them to choose the message it shows — so the server's refusal codes
    // are mapped back rather than collapsed into one generic failure.
    if (payload.code === 'retry_limit') {
      throw new PaymentRetryLimitError(
        payload.retry_count ?? RETRY_LIMIT,
        RETRY_LIMIT
      );
    }
    if (payload.code === 'retry_cooling') {
      throw new PaymentRetryCoolingError(payload.wait_ms ?? 0);
    }
    if (payload.code === 'retry_expired') {
      throw new PaymentRetryExpiredError();
    }
    throw new Error(payload.error || 'Could not retry this payment');
  }

  // NFR-007: audit. Non-throwing — never break the user flow over an audit write.
  await logPaymentRetryEvent({
    userId,
    originalIntentId: intentId,
    newIntentId: payload.deduped ? null : (payload.intent_id ?? null),
    retryCount: payload.retry_count ?? 0,
    deduped: Boolean(payload.deduped),
  });

  // The caller wants the intent row. SELECT is still granted to the browser; only
  // INSERT is being removed (#559 T027).
  const id = payload.intent_id ?? intentId;
  const { data: intent, error } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !intent) {
    throw new Error(
      'Retry succeeded but the new payment could not be read back'
    );
  }
  return intent as PaymentIntent;
}

/**
 * Get payment intent by ID
 * REQ-SEC-001: Requires authentication, RLS ensures user owns the intent
 */
export async function getPaymentIntent(
  intentId: string
): Promise<PaymentIntent | null> {
  // Require authentication (REQ-SEC-001)
  await getAuthenticatedUserId();

  // RLS policy ensures user can only access their own intents
  const { data, error } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();

  if (error) throw error;
  return data as PaymentIntent | null;
}

/**
 * Recovery-flow accessor: returns the fields needed to seed a new
 * `<PaymentButton>` from a previously-failed parent intent. Throws if
 * the parent is missing, has reached the retry cap, or has expired —
 * mirroring `retryFailedPayment`'s server-side guards so the recovery
 * panel can fail fast before it mounts.
 *
 * RLS still enforces ownership; this is a UX-shaped wrapper, not a
 * security boundary.
 */
export interface ParentIntentForRetry {
  amount: number;
  currency: Currency;
  type: PaymentType;
  interval: PaymentInterval | null;
  customer_email: string;
  description: string | null;
  retry_count: number;
}

export async function getParentIntentForRetry(
  intentId: string
): Promise<ParentIntentForRetry> {
  await getAuthenticatedUserId();

  const { data: parent, error } = await supabase
    .from('payment_intents')
    .select(
      'amount, currency, type, interval, customer_email, description, retry_count, expires_at'
    )
    .eq('id', intentId)
    .single();

  if (error) throw error;
  if (!parent) {
    throw new Error('Cannot recover — original payment intent not found.');
  }

  if (parent.retry_count >= RETRY_LIMIT) {
    throw new PaymentRetryLimitError(parent.retry_count, RETRY_LIMIT);
  }

  if (new Date(parent.expires_at).getTime() < Date.now()) {
    throw new PaymentRetryExpiredError();
  }

  return {
    amount: parent.amount,
    currency: parent.currency as Currency,
    type: parent.type as PaymentType,
    interval: parent.interval as PaymentInterval | null,
    customer_email: parent.customer_email,
    description: parent.description,
    retry_count: parent.retry_count,
  };
}

/**
 * Check if payment intent has expired
 */
export function isPaymentIntentExpired(intent: PaymentIntent): boolean {
  const expiresAt = new Date(intent.expires_at);
  return expiresAt < new Date();
}

/**
 * Format currency for display
 */
export function formatPaymentAmount(
  amountInCents: number,
  currency: Currency
): string {
  const amount = amountInCents / 100;
  const currencySymbols: Record<Currency, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
    cad: 'CA$',
    aud: 'AU$',
  };
  const symbol = currencySymbols[currency];
  return `${symbol}${amount.toFixed(2)}`;
}
