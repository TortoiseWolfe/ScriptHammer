#!/usr/bin/env node
/**
 * Assert that LIVE production still delivers a Content-Security-Policy that a browser
 * will actually honour (#393).
 *
 * WHY THIS EXISTS. The policy was authored in `src/app/layout.tsx` under
 * `metadata.other`, which renders `<meta name="Content-Security-Policy">`. A CSP in
 * `<meta name>` form is INERT — browsers honour only `<meta http-equiv>` or the HTTP
 * header. So a carefully maintained ten-directive policy was enforced exactly never.
 * Verified behaviourally before the fix: loading a stylesheet from an origin the policy
 * excludes fired `onload` and produced zero `securitypolicyviolation` events.
 *
 * That is the same family as the cache rules #635 fixed, and it has the same shape as
 * a problem: the cure lives in a Cloudflare Response Header Transform Rule, in a
 * dashboard, NOT in this repository. Delete the rule, rotate the token or move the zone
 * and the policy vanishes silently, leaving behind exactly what was there before — a
 * site with no CSP and no way to notice.
 *
 * WHAT IT CHECKS
 *
 *   1. A CSP header is present at all (enforcing OR report-only).
 *   2. It is served through Cloudflare (`cf-ray`), since the edge is what sets it.
 *   3. The directives that carry the security value are present, not merely SOME
 *      header — a policy trimmed to `default-src 'self'` would pass a presence check
 *      while allowing everything the real one names.
 *   4. `object-src 'none'` and `base-uri 'self'` survive: both are cheap, neither has
 *      a legitimate use here, and both are common first casualties of loosening.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 *
 *   - Whether the policy is ENFORCING rather than report-only. It ships report-only
 *     first, by design, because enforcing an untested policy breaks sign-up and
 *     checkout silently — `js.stripe.com` loads a script AND an iframe on /checkout/
 *     and appeared in neither directive before this work. Tighten this script to
 *     require the enforcing header as part of the flip, and not before.
 *   - Whether every origin the site needs is allowed. That is what report-only mode
 *     is collecting; a header can be perfectly delivered and still wrong.
 */

const site = (process.argv[2] || 'https://scripthammer.com').replace(
  /\/+$/,
  ''
);

/** Directives whose absence would quietly gut the policy. */
const REQUIRED = [
  "default-src 'self'",
  'script-src',
  'style-src',
  'frame-src',
  'connect-src',
  "object-src 'none'",
  "base-uri 'self'",
];

const fail = (msg) => {
  console.error(`::error::${msg}`);
  process.exitCode = 1;
};

const res = await fetch(`${site}/`, { redirect: 'follow' });
const enforcing = res.headers.get('content-security-policy');
const reportOnly = res.headers.get('content-security-policy-report-only');
const policy = enforcing ?? reportOnly;
const cfRay = res.headers.get('cf-ray');

console.log(`site            : ${site}`);
console.log(
  `mode            : ${enforcing ? 'ENFORCING' : reportOnly ? 'report-only' : 'NONE'}`
);
console.log(`served via edge : ${cfRay ? 'yes (cf-ray)' : 'NO'}`);

if (!policy) {
  fail(
    'no Content-Security-Policy header on production. The policy is set by a Cloudflare ' +
      'Response Header Transform Rule; if that rule was deleted, the token rotated or the ' +
      'zone moved, the site is back to having no CSP at all (#393). Note a `<meta name>` ' +
      'CSP does NOT count and is what this issue was about.'
  );
  process.exit();
}

if (!cfRay) {
  fail(
    'a CSP header is present but the response did not come through Cloudflare (no cf-ray). ' +
      'Something else is setting it, so the rule this check exists to guard is unverified.'
  );
}

const missing = REQUIRED.filter((d) => !policy.includes(d));
if (missing.length) {
  fail(
    `the CSP is present but has lost directives: ${missing.join(', ')}. A policy trimmed ` +
      `toward \`default-src\` alone passes a presence check while permitting what the full ` +
      `policy forbids.`
  );
}

console.log(`directives      : ${policy.split(';').length}`);
console.log(`length          : ${policy.length} chars`);
if (!process.exitCode) {
  console.log(
    reportOnly && !enforcing
      ? '\nOK — delivered and honoured, in report-only mode (#393 step 1).'
      : '\nOK — delivered and enforcing.'
  );
}
