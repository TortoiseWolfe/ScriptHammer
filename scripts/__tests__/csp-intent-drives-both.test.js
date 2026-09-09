/**
 * The CSP is declared once and both the checker and the applier read that declaration (#1110).
 *
 * WHAT WENT WRONG. Production's policy permitted neither scheduler origin, so enforcing it
 * would have blanked the booking page. It went unnoticed for as long as the policy existed
 * because of three independent blind spots, and this file exists to close the ones that are
 * closable in code:
 *
 *   1. `planCsp` could rename the header KEY and nothing else — it literally printed
 *      "policy value unchanged". The only copy of the policy was a dashboard text box.
 *   2. `check-csp-header.mjs` asserted directive NAMES by substring, so
 *      `policy.includes('frame-src')` was true whether the origin sat in `frame-src`, in
 *      `script-src`, or nowhere near either.
 *   3. The rule PATCH had never once succeeded — see `the applier sends a rule Cloudflare will
 *      accept` below.
 *
 * The third blind spot has no test here that can prove the fix (it needs Cloudflare), so what
 * IS asserted is the shape that the two rejections named.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');

const CI = path.resolve(__dirname, '..', 'ci');
const CHECKER = path.join(CI, 'check-csp-header.mjs');
const APPLIER = path.join(CI, 'cloudflare-apply.mjs');

const intent = () => import(`file://${path.join(CI, 'cloudflare-intent.mjs')}`);

function listen(server) {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  );
}

/** Serves one CSP header. MUST be async — see check-captcha-honesty.test.js for the deadlock. */
function siteServing(policy) {
  return createServer((req, res) => {
    res.writeHead(200, {
      'content-type': 'text/html',
      'content-security-policy-report-only': policy,
      'cf-ray': 'test-ray',
    });
    res.end('<!doctype html><html><body>ok</body></html>');
  });
}

function runChecker(base, env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CHECKER, base],
      { encoding: 'utf8', timeout: 20000, env: { ...process.env, ...env } },
      (err, stdout, stderr) =>
        resolve({ code: err?.code ?? 0, out: `${stdout}${stderr}` })
    );
  });
}

describe('the CSP intent drives both the check and the change (#1110)', () => {
  it('puts the scheduler in EVERY directive it is read from, and no others', async () => {
    const m = await intent();
    const d = m.cspDirectives('calcom');
    for (const directive of m.SCHEDULER_DIRECTIVES) {
      for (const origin of m.SCHEDULER_ORIGINS.calcom) {
        assert.ok(
          d[directive].includes(origin),
          `${directive} is missing ${origin} — the embed loads a SCRIPT and opens an IFRAME, ` +
            'so permitting one directive and not the other still breaks booking'
        );
      }
    }
    // Measured, not assumed: the embed's tRPC traffic is issued by the iframe document under
    // Cal.com's own policy, and production reported no connect-src violation. Widening it
    // would be permission granted for nothing.
    assert.ok(!d['connect-src'].includes('https://app.cal.com'));
  });

  it('adds nothing at all when no provider is configured', async () => {
    const m = await intent();
    assert.deepStrictEqual(m.cspDirectives(null), m.CSP_DIRECTIVES);
  });

  it('ANTI-VACUITY: the checker reads DIRECTIVES, not substrings', async () => {
    // The load-bearing case. The old check was `policy.includes('frame-src')`, which cannot
    // tell where an origin sits. This policy names both directives and puts the origin in the
    // WRONG one — a substring check passes it; a real parse must not.
    const m = await intent();
    const misplaced = m
      .cspPolicy(null)
      .replace("script-src 'self'", "script-src 'self' https://app.cal.com");
    const server = siteServing(misplaced);
    const port = await listen(server);
    try {
      const r = await runChecker(`http://127.0.0.1:${port}`, {
        REQUIRE_CSP: 'true',
        NEXT_PUBLIC_CALENDAR_PROVIDER: 'calcom',
      });
      assert.match(
        r.out,
        /frame-src is missing https:\/\/app\.cal\.com/,
        `the origin is present in script-src only, and the checker did not notice:\n${r.out}`
      );
      assert.notStrictEqual(r.code, 0);
    } finally {
      server.close();
    }
  });

  it('CONTROL: the same checker passes when both directives carry it', async () => {
    // Without this the assertion above could be satisfied by a checker that always fails.
    const m = await intent();
    const server = siteServing(m.cspPolicy('calcom'));
    const port = await listen(server);
    try {
      const r = await runChecker(`http://127.0.0.1:${port}`, {
        REQUIRE_CSP: 'true',
        NEXT_PUBLIC_CALENDAR_PROVIDER: 'calcom',
      });
      assert.strictEqual(r.code, 0, r.out);
      assert.match(r.out, /permitted in script-src \+ frame-src/);
    } finally {
      server.close();
    }
  });

  it('a fork that has not opted in is told, not failed', async () => {
    const m = await intent();
    const server = siteServing(m.cspPolicy(null));
    const port = await listen(server);
    try {
      const r = await runChecker(`http://127.0.0.1:${port}`, {
        REQUIRE_CSP: '',
        NEXT_PUBLIC_CALENDAR_PROVIDER: 'calcom',
      });
      assert.strictEqual(
        r.code,
        0,
        `a fork was failed for a policy it did not author:\n${r.out}`
      );
      assert.match(r.out, /NOT permitted/);
    } finally {
      server.close();
    }
  });

  it('the applier sends a rule Cloudflare will accept', () => {
    // NOT a style preference. The PATCH body used to be `{action_parameters: {headers}}`, and
    // Cloudflare rejected it twice over — `action is required for action parameters`, then
    // `20125 '' is not a valid value for expression because the expression cannot be blank`.
    // A rule PATCH REPLACES the rule, so it must replay the rule's own fields. This write had
    // therefore never succeeded, which means #393's documented flip procedure would have
    // failed the first time anyone ran it.
    const src = fs.readFileSync(APPLIER, 'utf8');
    const body =
      /body: JSON\.stringify\(\{\s*\.\.\.p\.rule,\s*action_parameters/.test(
        src
      );
    assert.ok(
      body,
      'the CSP PATCH no longer replays the rule (`...p.rule`). Cloudflare rejects a rule ' +
        'update that omits `action` or `expression`, so this write would fail on every run.'
    );
    for (const field of [
      'action:',
      'expression:',
      'description:',
      'enabled:',
    ]) {
      assert.ok(
        src.includes(field),
        `planCsp no longer carries ${field} through to the PATCH`
      );
    }
  });

  it('refuses to APPLY a policy without an explicit provider', () => {
    // The default is `calendly`, to match calendar.config.ts. Right for reading, and wrong for
    // writing: applying it to a Cal.com deployment would push Calendly's origins into the
    // policy and block the site's own embed. Same family as #1054.
    const src = fs.readFileSync(APPLIER, 'utf8');
    assert.match(
      src,
      /apply &&[\s\S]{0,120}!process\.env\.NEXT_PUBLIC_CALENDAR_PROVIDER/,
      'the apply-time provider guard is gone'
    );
  });
});
