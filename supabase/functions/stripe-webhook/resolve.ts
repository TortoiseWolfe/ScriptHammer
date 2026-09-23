/**
 * stripe-webhook — pure decision logic for WHICH signing secret may verify a delivery (#1229).
 *
 * ZERO IMPORTS, DELIBERATELY. Nothing in CI executes an Edge Function: `tsconfig.json`
 * excludes `supabase/`, Vitest excludes `supabase/functions/**` from DISCOVERY, and
 * `edge-functions.yml` runs `deno check` but is deliberately not required because it
 * resolves over the network (#1153). So the rule lives here, importing nothing, and
 * `tests/unit/` loads it directly — the pattern `create-order` established.
 *
 * THE DEFECT THIS REPLACES. The function used to build a LIST of both signing secrets and
 * try each in turn, keeping whichever verified. Both are configured in production, and both
 * Stripe endpoints point at the same function URL:
 *
 *   live  we_1U5ZAe…  signed with STRIPE_WEBHOOK_SECRET_LIVE
 *   test  we_1U1geo…  signed with STRIPE_WEBHOOK_SECRET
 *
 * So an event signed with the TEST secret verified against the LIVE deployment, and the
 * handler never learned which secret matched — a fabricated `payment_intent.succeeded` would
 * be processed against real rows, marking an order paid with no card and no money.
 *
 * A test-mode signing secret is ordinarily treated as low-sensitivity: shared with
 * development, pasted into local `.env` files, printed in transcripts. That assumption is
 * exactly what the old shape broke.
 *
 * THE RULE. A deployment that HAS a live secret IS the live deployment, and accepts only
 * live signatures. Anything else accepts only test signatures. This makes a test-endpoint
 * secret inert against production by construction, rather than by remembering to keep it
 * secret — the distinction that matters, because rotation does not fix a shape.
 */

/** The secret a deployment may verify with, and the mode it therefore expects. */
export interface SigningChoice {
  /** Which env var supplies it — the VALUE never appears here or in any log. */
  name: 'STRIPE_WEBHOOK_SECRET_LIVE' | 'STRIPE_WEBHOOK_SECRET';
  secret: string;
  /** The `livemode` every event verified by this secret must carry. */
  expectLivemode: boolean;
}

export type SigningResolution =
  | { ok: true; choice: SigningChoice }
  | { ok: false; reason: string };

/**
 * Pick the one secret this deployment may verify with.
 *
 * Deliberately NOT "try each": the whole defect was that trying each made the two modes
 * interchangeable. Exactly one is eligible, decided by deployment, before any signature is
 * examined.
 */
export function resolveSigningSecret(
  env: Record<string, string | undefined>
): SigningResolution {
  const live = (env.STRIPE_WEBHOOK_SECRET_LIVE ?? '').trim();
  const test = (env.STRIPE_WEBHOOK_SECRET ?? '').trim();

  // A webhook configured WITHOUT a secret still sends the header, valued
  // `no-secret-provided` (#562) — so an empty-ish secret must be treated as absent here
  // too, or it becomes a second way to accept unsigned traffic.
  const usable = (s: string) => s.length > 0 && s !== 'no-secret-provided';

  if (usable(live)) {
    return {
      ok: true,
      choice: {
        name: 'STRIPE_WEBHOOK_SECRET_LIVE',
        secret: live,
        expectLivemode: true,
      },
    };
  }
  if (usable(test)) {
    return {
      ok: true,
      choice: {
        name: 'STRIPE_WEBHOOK_SECRET',
        secret: test,
        expectLivemode: false,
      },
    };
  }
  return {
    ok: false,
    reason:
      'No Stripe signing secret configured: set STRIPE_WEBHOOK_SECRET_LIVE (live endpoint) ' +
      'or STRIPE_WEBHOOK_SECRET (test endpoint).',
  };
}

/**
 * Does a verified event's mode agree with the secret that verified it?
 *
 * Kept even though `resolveSigningSecret` already picks one secret, because the two answer
 * DIFFERENT questions — which key signed this, and which mode Stripe sent it from — and
 * #1180 is the standing example of those two disagreeing for 31 days while everything
 * looked configured. A mismatch here means the endpoint and the secret have drifted apart,
 * which is worth a loud 400 rather than a silent write.
 */
export function livemodeMismatch(
  event: { livemode?: boolean } | null | undefined,
  choice: Pick<SigningChoice, 'name' | 'expectLivemode'>
): string | null {
  const actual = event?.livemode;
  if (typeof actual !== 'boolean') {
    return `event carries no boolean livemode; ${choice.name} expects ${choice.expectLivemode}`;
  }
  if (actual !== choice.expectLivemode) {
    return (
      `event livemode=${actual} but it verified against ${choice.name}, which only ` +
      `accepts livemode=${choice.expectLivemode}. The endpoint and the signing secret ` +
      `have drifted apart (#1229, and see #1180 for what that costs).`
    );
  }
  return null;
}
