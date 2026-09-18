/**
 * The OpenAI Ads click identifier, captured in the browser and only with consent.
 *
 * WHY THIS IS NOT A DATABASE COLUMN. FR-024a forbids storing marketing attribution on a booking
 * confirmation, and its stated reasoning (spec.md:486) is about consent rather than about tables:
 * keeping attribution for someone who "has declined analytics… reads as routing around a stated
 * preference". So the identifier lives here, in the one place a consent choice can actually be
 * honoured, and reaches the server only on the purchase path — never on `leads`.
 *
 * WHY OUR OWN CODE AND NOT THE PIXEL'S. OpenAI's pixel captures `oppref` into its own `__oppref`
 * cookie, but only once the pixel has loaded — and the pixel is a third-party SDK, so FR-026 holds
 * it behind consent too. Reading the parameter ourselves means the value survives the gap between
 * landing and the visitor accepting, without loading anything third-party to do it.
 *
 * Every storage access is guarded. `sessionStorage` throws outright in some privacy modes, and a
 * landing page that crashes over its own bookkeeping would be a poor trade — the same reasoning as
 * `src/lib/leads/record-lead.ts`.
 */

/** Where the click id is remembered for the rest of the session. */
const OPPREF_KEY = 'sh:ads:oppref';

/**
 * Longest value we will keep. OpenAI describes `oppref` as an opaque identifier and says to pass
 * it back unmodified, so we do not parse it — but an unbounded query parameter should not become
 * an unbounded write, and `create-order` caps serialised metadata at 1KB.
 */
const MAX_OPPREF_LENGTH = 512;

/** Opaque token: the character set a URL-safe identifier can use, and nothing else. */
const OPPREF_SHAPE = /^[A-Za-z0-9._~-]{1,512}$/;

/** True when the value is something we are willing to store and later send back. */
export function isValidOppref(
  value: string | null | undefined
): value is string {
  if (!value) return false;
  if (value.length > MAX_OPPREF_LENGTH) return false;
  return OPPREF_SHAPE.test(value);
}

/**
 * Remember the click id from the current URL, if there is one and consent allows it.
 *
 * Call on load. Returns the id now in effect, or null. Safe to call repeatedly: a later
 * navigation without the parameter must not erase what an earlier one captured.
 *
 * @param hasConsent whether the visitor has granted marketing consent
 */
export function captureOppref(hasConsent: boolean): string | null {
  if (typeof window === 'undefined') return null;

  // The whole gate. No consent means we neither read the parameter nor keep it — declining has
  // to actually mean something, not merely stop the value being transmitted later.
  if (!hasConsent) return null;

  let fromUrl: string | null = null;
  try {
    fromUrl = new URL(window.location.href).searchParams.get('oppref');
  } catch {
    // Malformed URL. Nothing to capture; fall through to whatever was already stored.
  }

  if (isValidOppref(fromUrl)) {
    try {
      window.sessionStorage.setItem(OPPREF_KEY, fromUrl);
    } catch {
      // Storage unavailable. The value is still returned for this page, so a conversion that
      // happens without a navigation is still attributable.
    }
    return fromUrl;
  }

  return readOppref(hasConsent);
}

/**
 * The click id remembered for this session, or null.
 *
 * Takes consent explicitly rather than reading it from a context so that a non-React caller —
 * the checkout submit path — cannot accidentally bypass the gate.
 */
export function readOppref(hasConsent: boolean): string | null {
  if (typeof window === 'undefined') return null;
  if (!hasConsent) return null;

  try {
    const stored = window.sessionStorage.getItem(OPPREF_KEY);
    return isValidOppref(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Forget the click id. Called when consent is withdrawn. */
export function clearOppref(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(OPPREF_KEY);
  } catch {
    // Nothing to do — if storage is unreachable there is nothing stored in it either.
  }
}
