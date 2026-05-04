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
  }
): Promise<PaymentIntent> {
  // Require authentication (REQ-SEC-001)
  const userId = await getAuthenticatedUserId();

  // Validate inputs
  validatePaymentAmount(amount);
  validateCurrency(currency);

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
  };

  // Check if online
  const isOnline = await isSupabaseOnline();

  if (!isOnline) {
    // Queue for later
    await queueOperation('payment_intent', intentData, userId);
    throw new Error(
      'You are offline. Payment has been queued and will be processed when connection returns.'
    );
  }

  try {
    const { data, error } = await supabase
      .from('payment_intents')
      .insert({
        amount: intentData.amount,
        currency: intentData.currency,
        type: intentData.type,
        interval: intentData.interval || null,
        customer_email: intentData.customer_email,
        description: intentData.description || null,
        metadata: (intentData.metadata || {}) as Json,
        template_user_id: userId, // REQ-SEC-001: Use authenticated user ID
        ...(options?.parent_intent_id && {
          parent_intent_id: options.parent_intent_id,
        }),
      })
      .select()
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
 * Cancel a pending payment intent
 * REQ-SEC-001: Requires authentication, RLS ensures user owns the intent
 */
export async function cancelPaymentIntent(intentId: string): Promise<void> {
  // Require authentication (REQ-SEC-001)
  await getAuthenticatedUserId();

  // Check if payment already processed
  const status = await getPaymentStatus(intentId);
  if (status) {
    throw new Error('Cannot cancel - payment already processed');
  }

  // Delete the intent (before expiration)
  // RLS policy ensures user can only delete their own intents
  const { error } = await supabase
    .from('payment_intents')
    .delete()
    .eq('id', intentId);

  if (error) throw error;
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

  const { data: parent, error: fetchError } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (fetchError) throw fetchError;
  if (!parent) {
    throw new Error('Cannot retry — original payment intent not found.');
  }

  // FR-009: cap retry attempts on this chain.
  if (parent.retry_count >= RETRY_LIMIT) {
    throw new PaymentRetryLimitError(parent.retry_count, RETRY_LIMIT);
  }

  // Expiry guard: a same-key retry against a stale provider session is
  // worse UX than refusing here.
  const now = Date.now();
  if (new Date(parent.expires_at).getTime() < now) {
    throw new PaymentRetryExpiredError();
  }

  // FR-010: cooling period since the parent was created.
  const elapsedMs = now - new Date(parent.created_at).getTime();
  if (elapsedMs < COOLING_PERIOD_MS) {
    throw new PaymentRetryCoolingError(COOLING_PERIOD_MS - elapsedMs);
  }

  // Reuse parent's idempotency_key if present; if absent (legacy intents
  // pre-PR #59), generate a fresh one so this retry chain still dedupes
  // with itself. Same fallback pattern as payment-adapter.ts:155-163.
  const idempotencyKey = parent.idempotency_key ?? crypto.randomUUID();
  const newRetryCount = parent.retry_count + 1;

  // Upsert with ignoreDuplicates: a doubled click on the retry button (same
  // idempotency_key reaching the server twice) returns a null row from the
  // ON CONFLICT path instead of a 23505. We surface that as "the retry is
  // a no-op, the original is still authoritative" by returning the parent.
  const { data: child, error: insertError } = await supabase
    .from('payment_intents')
    .upsert(
      {
        amount: parent.amount,
        currency: parent.currency,
        type: parent.type,
        interval: parent.interval,
        customer_email: parent.customer_email,
        description: parent.description,
        metadata: parent.metadata,
        template_user_id: userId, // RLS WITH CHECK enforces this anyway
        idempotency_key: idempotencyKey,
        parent_intent_id: parent.id,
        retry_count: newRetryCount,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();

  if (insertError) throw insertError;

  const deduped = !child;

  // NFR-007: audit. Non-throwing — never break the user flow over an
  // audit-log write failure.
  await logPaymentRetryEvent({
    userId,
    originalIntentId: parent.id,
    newIntentId: deduped ? null : (child as PaymentIntent).id,
    retryCount: newRetryCount,
    deduped,
  });

  // ON CONFLICT fired — the prior attempt's row is the truth.
  if (deduped) {
    return parent as PaymentIntent;
  }
  return child as PaymentIntent;
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
