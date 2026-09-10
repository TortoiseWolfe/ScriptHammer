/**
 * Every decision `calcom-webhook` makes, with nothing imported (#562 T037, T039).
 *
 * Same reason as `create-lead/resolve.ts`: nothing in CI executes an Edge Function, so a rule
 * written inside a `Deno.serve` handler is a rule nothing tests. `crypto.subtle` is a Web
 * Crypto global present in both Deno and Vitest's Node, so signature verification can live
 * here and still be exercised — which matters more here than anywhere else in the repo,
 * because this is the file that decides whether to trust a stranger's POST.
 */

/** What Cal.com sends. Only the parts this function reads are named. */
export interface CalcomEvent {
  triggerEvent?: string;
  payload?: {
    uid?: string;
    bookingId?: number;
    startTime?: string;
    responses?: Record<string, { value?: unknown; label?: string } | undefined>;
    attendees?: Array<{ name?: string; email?: string }>;
  };
}

export type BookingOutcome =
  | { kind: 'ignored'; reason: string }
  | { kind: 'unattributed'; reason: string; eventId: string }
  | {
      kind: 'attributed';
      eventId: string;
      leadRef: string;
      name: string | null;
      email: string | null;
      scheduledAt: string | null;
    };

/**
 * The header Cal.com actually sends, MEASURED rather than read from documentation.
 *
 * A live delivery on 2026-09-10 carried `x-cal-signature-256` with a value of 64 hex
 * characters and NO prefix. This matters more than usual: `agents/skills/calcom-api/
 * references/webhooks.md` inside Cal.com's OWN repository compares against
 * `` `sha256=${expected}` ``, which would reject every real delivery, and it is the document
 * an agent researching this problem is most likely to find. Do not "fix" this to match it.
 */
export const SIGNATURE_HEADER = 'x-cal-signature-256';

/** Hex, lowercase, no prefix — as measured. */
const HEX_64 = /^[0-9a-f]{64}$/i;

/**
 * Cal.com's own literal for an UNSECURED webhook.
 *
 * A webhook created without a secret still sends the signature header, valued
 * `no-secret-provided`. A receiver written the obvious way — `if (!sig) return 401` — has a
 * present, non-empty header and lets it through. Rejecting the literal explicitly is the only
 * form that fails closed.
 */
export const NO_SECRET_SENTINEL = 'no-secret-provided';

/** Compare without leaking position through timing. Lengths differ → false, no early exit. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Is this POST really from Cal.com?
 *
 * HMAC-SHA256 over the RAW body with the webhook's secret, compared against the header. The
 * body must be the exact bytes received — re-serialising parsed JSON reorders keys and
 * produces a different digest, which is why `index.ts` reads `req.text()` once and passes the
 * string through rather than handing this function an object.
 */
export async function verifySignature(
  rawBody: string,
  secret: string,
  headerValue: string | null
): Promise<{ ok: boolean; reason?: string }> {
  if (!secret) return { ok: false, reason: 'no signing secret configured' };
  if (!headerValue) return { ok: false, reason: 'missing signature header' };
  if (headerValue === NO_SECRET_SENTINEL) {
    return { ok: false, reason: 'webhook is configured without a secret' };
  }
  if (!HEX_64.test(headerValue)) {
    return { ok: false, reason: 'signature is not 64 hex characters' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody)
  );

  return timingSafeEqual(toHex(mac).toLowerCase(), headerValue.toLowerCase())
    ? { ok: true }
    : { ok: false, reason: 'signature mismatch' };
}

/** A lead id is a UUID. Anything else is not ours and is not worth a database round trip. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * What to do about one delivery.
 *
 * THE JOIN IS `payload.responses.lead_ref`, AND THAT IS A MEASURED CHOICE. The obvious
 * carrier, `utm_content`, does not survive: Cal.com stores auto-tracked UTM parameters in a
 * separate Tracking table readable only in its own logged-in UI, and the request to forward
 * them (`cal.diy#24759`) has been open since 2025-10-29. A hidden custom booking field does
 * arrive — verified on a real delivery as
 * `responses.lead_ref = { value: "…", isHidden: true }`.
 *
 * A booking with no `lead_ref` is NOT an error. Somebody can always book straight from a
 * Cal.com link that never passed through this site, and that is a normal thing to do — it is
 * simply a booking this system cannot attribute. It gets recorded and acknowledged, never
 * retried.
 */
export function resolveBooking(event: CalcomEvent): BookingOutcome {
  if (event?.triggerEvent !== 'BOOKING_CREATED') {
    return {
      kind: 'ignored',
      reason: `trigger ${String(event?.triggerEvent ?? 'missing')} is not handled`,
    };
  }

  const payload = event.payload ?? {};
  // `uid` is Cal.com's stable booking identifier and is what makes a redelivery detectable.
  const eventId = typeof payload.uid === 'string' ? payload.uid : '';
  if (!eventId) {
    return { kind: 'ignored', reason: 'payload carries no booking uid' };
  }

  const raw = payload.responses?.['lead_ref']?.value;
  const leadRef = typeof raw === 'string' ? raw.trim() : '';

  if (!leadRef) {
    return {
      kind: 'unattributed',
      reason: 'booking carries no lead_ref',
      eventId,
    };
  }
  if (!UUID.test(leadRef)) {
    return {
      kind: 'unattributed',
      reason: 'lead_ref is not a lead id',
      eventId,
    };
  }

  const attendee = payload.attendees?.[0] ?? {};
  return {
    kind: 'attributed',
    eventId,
    leadRef,
    name: typeof attendee.name === 'string' ? attendee.name : null,
    email: typeof attendee.email === 'string' ? attendee.email : null,
    scheduledAt:
      typeof payload.startTime === 'string' ? payload.startTime : null,
  };
}
