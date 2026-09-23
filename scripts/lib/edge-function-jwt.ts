/**
 * Whether each Edge Function requires a Supabase platform JWT (#1188).
 *
 * WHY THIS FILE EXISTS. A deploy must REPLAY this flag. The Management API does not preserve
 * it for you: deploy a function without saying what `verify_jwt` should be and you can flip it,
 * which either starts 401ing a live provider whose webhook cannot send a JWT, or silently
 * removes the platform auth gate from an endpoint that was relying on it. That is why
 * `plan-edge-deploy.ts` refuses `--apply`, and this table is what unblocks it.
 *
 * CAPTURED FROM PRODUCTION, NOT CHOSEN. Read from
 * `GET /v1/projects/{ref}/functions` on 2026-09-23. I had previously written in #1188 that this
 * boolean "lives only in an operator's head" — that was wrong. It lives in the deployed state
 * and is readable. Guessing was never necessary; asking was never necessary.
 *
 * `scripts/supabase/check-verify-jwt.ts` compares this table against the live project, so a
 * change made in the dashboard shows up as drift here rather than as a surprise at deploy time.
 *
 * WHAT THE VALUES MEAN, because `false` reads alarming and mostly is not:
 *
 *   false  the platform does not check a JWT. CORRECT for a provider webhook — Stripe, PayPal
 *          and Cal.com cannot send one — and for anything that authenticates its own callers
 *          via `_shared/auth.ts`. It is NOT a statement that the endpoint is unprotected.
 *   true   the platform rejects any request without a valid Supabase JWT before the function
 *          runs at all.
 *
 * Exactly one function currently requires a JWT. Whether each `false` is BACKED by the
 * function's own auth or signature check is a separate question from what this table records;
 * this file states what the platform does, not whether it is sufficient.
 */

/** slug -> does the platform require a JWT. Sorted, so a diff is readable. */
export const VERIFY_JWT: Readonly<Record<string, boolean>> = Object.freeze({
  'calcom-webhook': false,
  'cancel-subscription': false,
  'capture-paypal-order': false,
  'contact-message': false,
  'create-lead': false,
  'create-order': false,
  'create-paypal-order': false,
  'create-paypal-subscription': false,
  'create-stripe-checkout': false,
  'create-stripe-subscription': false,
  'delete-account': true,
  'paypal-webhook': false,
  'resume-subscription': false,
  'retry-subscription': false,
  'send-payment-email': false,
  'stripe-webhook': false,
  'sweep-intake-orphans': false,
  'verify-stripe-session': false,
});

/** The slug set this table claims to describe. */
export function declaredSlugs(): string[] {
  return Object.keys(VERIFY_JWT).sort();
}

/**
 * Compare a live reading against the table.
 *
 * Returns every disagreement rather than the first, because a dashboard edit and a missing
 * deploy look identical from one row and different from three.
 */
export function jwtDrift(
  live: Record<string, boolean>
): Array<{ slug: string; declared?: boolean; live?: boolean; kind: string }> {
  const out: Array<{
    slug: string;
    declared?: boolean;
    live?: boolean;
    kind: string;
  }> = [];
  for (const slug of new Set([
    ...Object.keys(VERIFY_JWT),
    ...Object.keys(live),
  ])) {
    const declared = VERIFY_JWT[slug];
    const actual = live[slug];
    if (declared === undefined)
      out.push({ slug, live: actual, kind: 'undeclared' });
    else if (actual === undefined)
      out.push({ slug, declared, kind: 'missing-in-project' });
    else if (declared !== actual)
      out.push({ slug, declared, live: actual, kind: 'changed' });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
