/**
 * Classify how a buyer arrived at /payment-result.
 *
 * Pure and separate from the page so the routing decision can be tested without
 * mounting React, auth, or a provider — this is the money path, and until now it
 * was wrong in a way no test could have caught, because there was no seam to test.
 *
 * THE BUG THIS EXISTS TO PREVENT. /payment-result read only `?id=`, while Stripe's
 * success_url sends `?session_id=…&status=succeeded`
 * (create-stripe-checkout/index.ts:145) and its cancel_url sends `?status=cancelled`
 * with no id at all. So a completed purchase landed on the "no payment ID" screen,
 * and a buyer who backed out saw the same thing as a broken link.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReturnRoute =
  /** No provider keys are set — nothing downstream can work. */
  | { kind: 'not-configured' }
  /** `?id=<uuid>` — our own links. Resolve status directly. */
  | { kind: 'intent'; intentId: string }
  /** `?session_id=cs_…` — Stripe's redirect. Must be exchanged for an intent id. */
  | { kind: 'session'; sessionId: string }
  /** `?status=cancelled` with no ids — the buyer backed out. Not an error. */
  | { kind: 'cancelled' }
  /** Nothing usable in the URL. */
  | { kind: 'missing-id' };

export type ReturnParams = {
  id?: string | null;
  sessionId?: string | null;
  status?: string | null;
  providersConfigured: boolean;
};

/**
 * Precedence is deliberate:
 *
 * 1. `not-configured` first — with no provider keys every later branch would fail
 *    in a less comprehensible way.
 * 2. `id` before `session_id`. Our own id needs no network round-trip, so when
 *    both are present prefer the cheaper, authoritative one.
 * 3. `session_id` before `status`. Stripe's success_url carries BOTH
 *    `session_id` and `status=succeeded`; reading status first would discard the
 *    session and lose the only handle on the purchase.
 * 4. `cancelled` before the generic fallback, so a deliberate cancellation never
 *    renders as a broken link.
 *
 * A malformed `id` falls through to `missing-id` rather than being sent to the
 * backend — it cannot match a row, and rejecting it here keeps a hand-edited URL
 * from reaching a query.
 */
export function classifyReturn(p: ReturnParams): ReturnRoute {
  if (!p.providersConfigured) return { kind: 'not-configured' };

  const id = p.id?.trim();
  if (id) {
    return UUID_RE.test(id)
      ? { kind: 'intent', intentId: id }
      : { kind: 'missing-id' };
  }

  const sessionId = p.sessionId?.trim();
  if (sessionId) return { kind: 'session', sessionId };

  if (p.status === 'cancelled') return { kind: 'cancelled' };

  return { kind: 'missing-id' };
}
