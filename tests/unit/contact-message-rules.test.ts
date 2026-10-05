/**
 * @vitest-environment node
 */
// Node, not jsdom: idempotencyKeyFor uses the global Web Crypto, as Deno provides it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  captchaTokenFrom,
  idempotencyKeyFor,
  isUndeliverableAddress,
  originVerdict,
  resendOutcome,
  siteverifyVerdict,
} from '../../supabase/functions/contact-message/rules';
import { UNCONFIRMED_MESSAGE } from '../../src/utils/email/types';

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

// (#1322) A resend of a message whose response was lost must not deliver a second copy. The
// key is what Resend deduplicates on, so it has to be identical for identical text, and
// different the moment any field differs.
describe('idempotencyKeyFor', () => {
  const base = {
    name: 'Ada Lovelace',
    email: 'ada@lovelace.dev',
    subject: 'Engines',
    message: 'About the analytical engine.',
  };

  it('gives the same key for the same message, every time', async () => {
    expect(await idempotencyKeyFor(base)).toBe(
      await idempotencyKeyFor({ ...base })
    );
  });

  it.each(['name', 'email', 'subject', 'message'] as const)(
    'gives a different key when only the %s differs',
    async (field) => {
      expect(
        await idempotencyKeyFor({ ...base, [field]: `${base[field]}!` })
      ).not.toBe(await idempotencyKeyFor(base));
    }
  );

  // Joining fields without structure collides. Plain concatenation turns "ab"+"c" and
  // "a"+"bc" into the same string, and a comma join (`String([...])`) does the same to
  // "a,b"+"c" and "a"+"b,c". Both would make two different messages share one key, so the
  // second would be silently swallowed as a "duplicate".
  it.each([
    [
      { name: 'ab', email: 'c' },
      { name: 'a', email: 'bc' },
    ],
    [
      { name: 'a,b', email: 'c' },
      { name: 'a', email: 'b,c' },
    ],
  ])('cannot be fooled by moving text between fields', async (one, two) => {
    expect(await idempotencyKeyFor({ ...base, ...one })).not.toBe(
      await idempotencyKeyFor({ ...base, ...two })
    );
  });

  it('is namespaced, hex, and well inside Resend’s 256-character limit', async () => {
    const key = await idempotencyKeyFor(base);
    expect(key).toMatch(/^contact-message\/[0-9a-f]{64}$/);
    expect(key.length).toBeLessThanOrEqual(256);
  });
});

describe('resendOutcome', () => {
  it('reads a 2xx as sent', () => {
    expect(resendOutcome(true, 200, { id: 'x' })).toBe('sent');
  });

  // The two 409s Resend documents for idempotency keys. Neither delivered a second copy.
  it('reads a reused key with a different payload as already sent', () => {
    expect(
      resendOutcome(false, 409, { name: 'invalid_idempotent_request' })
    ).toBe('already-sent');
  });

  it('reads a concurrent request with the same key as in flight', () => {
    expect(
      resendOutcome(false, 409, { name: 'concurrent_idempotent_requests' })
    ).toBe('in-flight');
  });

  it.each([
    ['a 409 with any other name', 409, { name: 'something_else' }],
    ['a 409 with no body', 409, null],
    ['a 422 validation error', 422, { name: 'validation_error' }],
    ['a 500', 500, {}],
  ])('reads %s as rejected', (_label, status, json) => {
    expect(resendOutcome(false, status as number, json)).toBe('rejected');
  });
});

// Nothing in CI executes index.ts, so the wiring is pinned from its syntax tree, the way
// edge-function-limiter.test.ts pins the limiter. Comments are not tokens, so prose that
// names the header can neither satisfy this nor break it.
it('index.ts sends the content key on the Resend call and reads the answer through resendOutcome', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase/functions/contact-message/index.ts'),
    'utf8'
  );
  const sf = ts.createSourceFile(
    'index.ts',
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let headerValue: string | null = null;
  const calls: Record<string, number> = {};
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const callee = n.expression.text;
      calls[callee] = (calls[callee] ?? 0) + 1;
      const url = n.arguments[0];
      const opts = n.arguments[1];
      if (
        callee === 'fetch' &&
        url &&
        ts.isStringLiteral(url) &&
        url.text.startsWith('https://api.resend.com') &&
        opts &&
        ts.isObjectLiteralExpression(opts)
      ) {
        for (const p of opts.properties) {
          if (
            ts.isPropertyAssignment(p) &&
            p.name.getText(sf) === 'headers' &&
            ts.isObjectLiteralExpression(p.initializer)
          ) {
            for (const h of p.initializer.properties) {
              if (
                ts.isPropertyAssignment(h) &&
                ts.isStringLiteral(h.name) &&
                h.name.text === 'Idempotency-Key'
              ) {
                headerValue = h.initializer.getText(sf);
              }
            }
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  expect(headerValue, 'the Resend call must carry Idempotency-Key').toBe(
    'idempotencyKey'
  );
  expect(calls.idempotencyKeyFor).toBe(1);
  expect(calls.resendOutcome).toBe(1);
});

// The function and the client each carry the "could not confirm" sentence: the function for
// Resend's in-flight 409, the client for a response that never arrived. Visitors must read the
// same words either way.
it('the function and the client say the same thing when delivery is unconfirmed', () => {
  const source = readFileSync(
    join(process.cwd(), 'supabase/functions/contact-message/index.ts'),
    'utf8'
  );
  expect(source).toContain(JSON.stringify(UNCONFIRMED_MESSAGE));
});
