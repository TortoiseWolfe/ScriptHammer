/**
 * Report a conversion to OpenAI Ads, server-side, from a webhook.
 *
 * WHY SERVER-SIDE AT ALL. The browser can report a sale from `/payment-result`, but only if the
 * buyer comes back — close the tab on Stripe's hosted page and the conversion is simply lost.
 * This fires from `stripe-webhook`, at the one moment payment is PROVEN.
 *
 * WHY THIS IS NOT A FR-024a PROBLEM. That requirement governs a booking confirmation received
 * from the scheduler; `leads` is untouched. The click id reaches here on
 * `payment_intents.metadata`, put there by `create-order` only when the visitor granted marketing
 * consent — so a visitor who declined has no `oppref` anywhere and nothing is reported for them.
 * The consent decision is made in the browser, where it can be honoured, and carried rather than
 * re-derived here, because a webhook cannot ask.
 *
 * NOTHING IN HERE MAY THROW. A rejection inside a Stripe webhook handler becomes a 500, Stripe
 * retries a 500 for three days, and sustained failures disable the endpoint — which is exactly
 * how the live webhook was lost for a month (#1180). Ad measurement is not permitted to cost the
 * money path. Every failure is logged and swallowed.
 */

const ENDPOINT = 'https://bzr.openai.com/v1/events';

/** Events we report. Mirrors OpenAI's supported-events list. */
export type AdEventType = 'order_created' | 'lead_created';

export interface AdConversion {
  /** Dedup key. Use the Stripe event id so a redelivery cannot double-count a sale. */
  id: string;
  type: AdEventType;
  /** The opaque click identifier. Without it OpenAI cannot match the conversion. */
  oppref: string;
  amountCents?: number | null;
  currency?: string | null;
  /** Unix ms. OpenAI rejects anything older than 7 days. */
  timestampMs?: number;
}

/**
 * Send one conversion. Returns whether it was reported — for logging and tests, never to branch
 * the caller's behaviour on.
 */
export async function reportAdConversion(
  conversion: AdConversion
): Promise<boolean> {
  const pixelId = Deno.env.get('OPENAI_ADS_PIXEL_ID');
  const apiKey = Deno.env.get('OPENAI_ADS_API_KEY');

  // Unconfigured is the normal state for a fork, and for this project until the keys are set.
  // Silence rather than noise: a missing optional integration is not an error.
  if (!pixelId || !apiKey) return false;
  if (!conversion.oppref) return false;

  const data: Record<string, unknown> = {
    type: conversion.type === 'order_created' ? 'contents' : 'customer_action',
  };
  if (typeof conversion.amountCents === 'number' && conversion.currency) {
    // OpenAI takes a major-unit amount; our columns are cents.
    data.amount = conversion.amountCents / 100;
    data.currency = conversion.currency.toUpperCase();
  }

  try {
    const res = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(pixelId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events: [
          {
            id: conversion.id,
            type: conversion.type,
            timestamp_ms: conversion.timestampMs ?? Date.now(),
            action_source: 'web',
            user: { oppref: conversion.oppref },
            data,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(
        `ad-conversions: ${conversion.type} not accepted (HTTP ${res.status}) — payment is unaffected`
      );
      return false;
    }
    console.log(
      `ad-conversions: reported ${conversion.type} for ${conversion.id}`
    );
    return true;
  } catch (err) {
    // Network failure, DNS, timeout. Swallowed on purpose — see the header.
    console.warn(
      `ad-conversions: ${conversion.type} failed to send — payment is unaffected:`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}
