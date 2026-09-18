/**
 * Report a conversion to OpenAI Ads from the browser.
 *
 * Deliberately tiny and deliberately silent. Every call site here is on a path that matters more
 * than the measurement does — a booking click, a completed purchase — so a failure to report must
 * never be visible to the visitor and must never throw into a caller.
 *
 * The pixel is loaded by `OpenAIPixel`, which only mounts with marketing consent. If it never
 * loaded, `window.oaiq` is undefined and every call here is a no-op. That is the consent gate
 * doing its job; there is no second check to keep in sync.
 *
 * Event names come from OpenAI's supported-events list. `lead_created` is a `customer_action`;
 * `order_created` is `contents` and may carry an amount.
 */

type OaiqFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    oaiq?: OaiqFn;
  }
}

/** Conversion events this app reports. Narrowed to what we actually send. */
export type AdConversionEvent = 'lead_created' | 'order_created';

/**
 * Fire a conversion. Returns whether it was reported, which callers may ignore — the return
 * exists so tests can assert the no-op path rather than so callers can branch on it.
 */
export function trackAdConversion(
  event: AdConversionEvent,
  data?: Record<string, unknown>
): boolean {
  if (typeof window === 'undefined') return false;

  const oaiq = window.oaiq;
  if (typeof oaiq !== 'function') return false;

  try {
    oaiq('event', event, data ?? {});
    return true;
  } catch {
    // A broken or blocked SDK must not surface on a booking or a receipt.
    return false;
  }
}
