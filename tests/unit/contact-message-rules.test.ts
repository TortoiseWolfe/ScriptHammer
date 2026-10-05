import { describe, it, expect } from 'vitest';
import {
  captchaTokenFrom,
  isUndeliverableAddress,
  originVerdict,
  siteverifyVerdict,
} from '../../supabase/functions/contact-message/rules';

/**
 * The decisions `contact-message` makes before it spends anything (#1319).
 *
 * Every contact email this project had ever delivered turned out to be a Playwright fixture
 * submitted by the hosted E2E lane. These rules are what keep a script — ours or anyone's —
 * from reaching the inbox, so each is pinned in both directions: a rule that only ever says
 * "allow" passes a one-sided suite just as well as one that works.
 */

describe('isUndeliverableAddress', () => {
  it.each([
    'john@example.com',
    'probe@EXAMPLE.ORG',
    'a@example.net',
    'a@mail.example.com', // subdomains are reserved with their parent
    'a@example.com.', // trailing dot: the same DNS name
    'x@foo.test',
    'x@foo.example',
    'x@foo.invalid',
    'x@localhost',
    'x@app.localhost',
    'no-at-sign',
  ])('refuses %s', (email) => {
    expect(isUndeliverableAddress(email)).toBe(true);
  });

  it.each([
    'ada@lovelace.dev',
    'someone@gmail.com',
    'a@examples.com', // not the reserved name, just near it
    'a@myexample.com',
    'a@example.co', // a real ccTLD registration, not RFC 2606
    'a@test.com', // `.test` is reserved as a TLD, not as a label
    'a@invalid.org',
  ])('accepts %s', (email) => {
    expect(isUndeliverableAddress(email)).toBe(false);
  });
});

describe('originVerdict', () => {
  const allowed = ['https://scripthammer.com', 'http://localhost:3000'];

  it('prints an allowlisted origin', () => {
    expect(originVerdict('https://scripthammer.com', allowed)).toEqual({
      ok: true,
      label: 'https://scripthammer.com',
    });
  });

  it('lets a request with no Origin through, without inventing a page for it', () => {
    for (const absent of [null, '']) {
      const v = originVerdict(absent, allowed);
      expect(v.ok).toBe(true);
      expect(v.ok && v.label).toMatch(/direct request/);
    }
  });

  // The footer used to print the header verbatim, so this exact value would have arrived
  // in the inbox as the page the message came from.
  it.each([
    'https://scripthammer.com.evil.example',
    'https://www.scripthammer.com', // redirects to the apex, so never a real page origin
    'http://scripthammer.com',
    'http://localhost:3002',
    'null',
  ])('refuses %s', (origin) => {
    expect(originVerdict(origin, allowed)).toEqual({ ok: false, origin });
  });
});

describe('captchaTokenFrom', () => {
  it('returns a trimmed token', () => {
    expect(captchaTokenFrom({ captchaToken: '  tok  ' })).toBe('tok');
  });

  it.each([
    ['absent', {}],
    ['empty', { captchaToken: '' }],
    ['blank', { captchaToken: '   ' }],
    ['not a string', { captchaToken: 42 }],
    ['longer than Cloudflare issues', { captchaToken: 'x'.repeat(2049) }],
  ])('treats %s as no token', (_label, body) => {
    expect(captchaTokenFrom(body as Record<string, unknown>)).toBeNull();
  });
});

describe('siteverifyVerdict', () => {
  it('passes only on an explicit success: true', () => {
    expect(siteverifyVerdict(true, { success: true })).toBe('pass');
  });

  it('rejects what Cloudflare rejects', () => {
    expect(
      siteverifyVerdict(true, {
        success: false,
        'error-codes': ['invalid-input-response'],
      })
    ).toBe('rejected');
    expect(
      siteverifyVerdict(true, {
        success: false,
        'error-codes': ['timeout-or-duplicate'],
      })
    ).toBe('rejected');
  });

  // None of these is a pass. The distinction from 'rejected' is only whose fault it is:
  // a check that could not run must not be read as a check that passed.
  it.each([
    ['an HTTP failure', false, { success: true }],
    ['an unparseable body', true, null],
    ['a body with no verdict', true, { hostname: 'scripthammer.com' }],
    ['a truthy non-boolean', true, { success: 'true' }],
    [
      "Cloudflare's own error",
      true,
      { success: false, 'error-codes': ['internal-error'] },
    ],
  ])('reports %s as unavailable', (_label, ok, json) => {
    expect(siteverifyVerdict(ok as boolean, json)).toBe('unavailable');
  });
});
