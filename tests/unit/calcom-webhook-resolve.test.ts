import { describe, it, expect } from 'vitest';
import {
  verifySignature,
  resolveBooking,
  timingSafeEqual,
  SIGNATURE_HEADER,
  NO_SECRET_SENTINEL,
} from '../../supabase/functions/calcom-webhook/resolve';

/**
 * This is the file that decides whether to trust a stranger's POST, and nothing in CI
 * executes an Edge Function — so these cases are the only thing standing behind that
 * decision. `crypto.subtle` is a Web Crypto global in both Deno and Vitest's Node, which is
 * what lets the real verifier be exercised here rather than a stand-in.
 */

const SECRET = 'probe-secret-1157';
const BODY = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: {} });

/** Produce a genuine signature the way Cal.com does: HMAC-SHA256 over the raw body, hex. */
async function sign(body: string, secret = SECRET): Promise<string> {
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
    new TextEncoder().encode(body)
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('the signature check can actually refuse', () => {
  it('accepts a genuine signature', async () => {
    expect(await verifySignature(BODY, SECRET, await sign(BODY))).toEqual({
      ok: true,
    });
  });

  it('refuses a body that changed by one character', async () => {
    // The whole point: the digest covers the bytes, so tampering must fail even when the
    // signature is otherwise well-formed and the secret is right.
    const sig = await sign(BODY);
    const tampered = BODY.replace('BOOKING_CREATED', 'BOOKING_CANCELLED');
    const r = await verifySignature(tampered, SECRET, sig);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('signature mismatch');
  });

  it('refuses a signature made with a different secret', async () => {
    const r = await verifySignature(BODY, SECRET, await sign(BODY, 'wrong'));
    expect(r.ok).toBe(false);
  });

  it('refuses the "no-secret-provided" literal, which is a PRESENT header', async () => {
    // Cal.com sends this when a webhook has no secret set. A receiver written as
    // `if (!sig) return 401` sees a non-empty string and lets unsigned traffic through —
    // the single sharpest trap in this integration.
    const r = await verifySignature(BODY, SECRET, NO_SECRET_SENTINEL);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/without a secret/);
  });

  it('refuses a prefixed signature, because the real header carries none', async () => {
    // Measured on a live delivery 2026-09-10: 64 hex characters, no `sha256=`. Cal.com's own
    // agent-skills doc compares against a prefixed form and would reject every real
    // delivery; if someone "fixes" this file to match that doc, this case fails.
    const r = await verifySignature(BODY, SECRET, `sha256=${await sign(BODY)}`);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/64 hex/);
  });

  it('refuses a missing header and an unconfigured secret, separately', async () => {
    expect((await verifySignature(BODY, SECRET, null)).reason).toMatch(
      /missing signature/
    );
    expect((await verifySignature(BODY, '', await sign(BODY))).reason).toMatch(
      /no signing secret/
    );
  });

  it('names the header Cal.com actually sends', () => {
    expect(SIGNATURE_HEADER).toBe('x-cal-signature-256');
  });

  it('compares without an early exit on the first differing character', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'ab')).toBe(false);
  });
});

const LEAD = '3f6c1a2e-8b4d-4c7a-9e1f-2b5d6c7a8e90';

const booking = (over: Record<string, unknown> = {}) => ({
  triggerEvent: 'BOOKING_CREATED',
  payload: {
    uid: 'bk_abc123',
    startTime: '2026-09-11T13:00:00.000Z',
    attendees: [{ name: 'Ada', email: 'ada@example.com' }],
    responses: { lead_ref: { label: 'Lead reference', value: LEAD } },
    ...over,
  },
});

describe('what to do about a delivery', () => {
  it('attributes a booking that carries a lead id', () => {
    expect(resolveBooking(booking())).toEqual({
      kind: 'attributed',
      eventId: 'bk_abc123',
      leadRef: LEAD,
      name: 'Ada',
      email: 'ada@example.com',
      scheduledAt: '2026-09-11T13:00:00.000Z',
    });
  });

  it('treats a booking with no lead_ref as normal, not as an error', () => {
    // Somebody can always book straight from a Cal.com link that never touched this site.
    // Answering that with an error would make the operator's webhook log red for people
    // booking calls correctly.
    const r = resolveBooking(booking({ responses: {} }));
    expect(r.kind).toBe('unattributed');
    if (r.kind === 'unattributed') expect(r.eventId).toBe('bk_abc123');
  });

  it('refuses a lead_ref that is not a lead id, without a database round trip', () => {
    for (const junk of ['../../etc', 'lead_test1', '1', 'DROP TABLE leads']) {
      const r = resolveBooking(
        booking({ responses: { lead_ref: { value: junk } } })
      );
      expect(r.kind, `expected ${junk} to be unattributed`).toBe(
        'unattributed'
      );
    }
  });

  it('ignores triggers it does not handle', () => {
    const r = resolveBooking({
      ...booking(),
      triggerEvent: 'BOOKING_CANCELLED',
    });
    expect(r.kind).toBe('ignored');
  });

  it('ignores a payload with no booking uid, since redelivery could not be detected', () => {
    const r = resolveBooking(booking({ uid: undefined }));
    expect(r.kind).toBe('ignored');
  });

  it('survives a payload missing every optional field', () => {
    const r = resolveBooking({
      triggerEvent: 'BOOKING_CREATED',
      payload: { uid: 'bk_x', responses: { lead_ref: { value: LEAD } } },
    });
    expect(r).toMatchObject({
      kind: 'attributed',
      name: null,
      email: null,
      scheduledAt: null,
    });
  });
});
