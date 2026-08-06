import { describe, it, expect } from 'vitest';
import { classifyReturn, UUID_RE } from '../payment-return';

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const configured = { providersConfigured: true };

describe('classifyReturn', () => {
  it('routes our own ?id= to a direct intent lookup', () => {
    expect(classifyReturn({ ...configured, id: UUID })).toEqual({
      kind: 'intent',
      intentId: UUID,
    });
  });

  // THE BUG. Stripe's success_url is `?session_id=cs_…&status=succeeded`, and the
  // page read only `id`, so every completed purchase rendered "no payment ID".
  it('routes Stripe’s success_url to a session exchange', () => {
    expect(
      classifyReturn({
        ...configured,
        sessionId: 'cs_test_a1b2c3',
        status: 'succeeded',
      })
    ).toEqual({ kind: 'session', sessionId: 'cs_test_a1b2c3' });
  });

  it('routes a subscription return the same way', () => {
    // create-stripe-subscription sends status=subscribed, not succeeded.
    expect(
      classifyReturn({
        ...configured,
        sessionId: 'cs_test_sub',
        status: 'subscribed',
      })
    ).toEqual({ kind: 'session', sessionId: 'cs_test_sub' });
  });

  it('treats Stripe’s cancel_url as a cancellation, not a broken link', () => {
    // cancel_url carries `?status=cancelled` and NO id of any kind.
    expect(classifyReturn({ ...configured, status: 'cancelled' })).toEqual({
      kind: 'cancelled',
    });
  });

  it('prefers session_id over status when Stripe sends both', () => {
    // Reading `status` first would discard the session id and lose the only
    // handle on the purchase.
    const r = classifyReturn({
      ...configured,
      sessionId: 'cs_test_x',
      status: 'succeeded',
    });
    expect(r.kind).toBe('session');
  });

  it('prefers our own id over a session id when both are present', () => {
    // The local id needs no network round-trip and is authoritative.
    expect(
      classifyReturn({ ...configured, id: UUID, sessionId: 'cs_test_x' })
    ).toEqual({ kind: 'intent', intentId: UUID });
  });

  it('rejects a malformed id instead of sending it to the backend', () => {
    for (const bad of ['not-a-uuid', '../../etc/passwd', '1 OR 1=1', '   ']) {
      expect(classifyReturn({ ...configured, id: bad }).kind).toBe(
        'missing-id'
      );
    }
  });

  it('reports not-configured before anything else', () => {
    // With no provider keys every later branch fails less comprehensibly.
    expect(
      classifyReturn({
        providersConfigured: false,
        id: UUID,
        sessionId: 'cs_test_x',
        status: 'cancelled',
      })
    ).toEqual({ kind: 'not-configured' });
  });

  it('falls back to missing-id on an empty or unrecognised URL', () => {
    expect(classifyReturn({ ...configured }).kind).toBe('missing-id');
    expect(classifyReturn({ ...configured, status: 'weird' }).kind).toBe(
      'missing-id'
    );
  });

  it('ignores surrounding whitespace rather than failing on it', () => {
    expect(classifyReturn({ ...configured, id: `  ${UUID}  ` })).toEqual({
      kind: 'intent',
      intentId: UUID,
    });
  });

  it('UUID_RE accepts a real uuid and rejects near-misses', () => {
    expect(UUID_RE.test(UUID)).toBe(true);
    expect(UUID_RE.test(UUID.slice(0, -1))).toBe(false); // too short
    expect(UUID_RE.test(UUID + 'a')).toBe(false); // too long
    expect(UUID_RE.test(UUID.replace('3f25', 'zzzz'))).toBe(false); // non-hex
  });
});
