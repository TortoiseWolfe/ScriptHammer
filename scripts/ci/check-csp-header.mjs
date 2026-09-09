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
 *   5. The DELIVERED MODE matches the mode this repo declares in
 *      `cloudflare-intent.mjs`. It is `report-only` today, deliberately: enforcing an
 *      untested policy breaks sign-up and checkout silently — `js.stripe.com` loads a
 *      script AND an iframe on /checkout/ and appeared in neither directive before this
 *      work. This used to be listed as something the script would not check "until the
 *      flip"; that left the flip itself unguarded in BOTH directions, so an accidental
 *      dashboard change either way was invisible. Declaring the mode makes tightening a
 *      one-line reviewed diff and makes a silent revert a red check.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 *
 *   - Whether every origin the site needs is allowed. That is what report-only mode
 *     is collecting; a header can be perfectly delivered and still wrong. This is the
 *     evidence the flip waits on, and no check here can supply it.
 */
import { CSP_MODE, intendedCspHeader,
  SCHEDULER_ORIGINS,
  SCHEDULER_DIRECTIVES,
  calendarProvider,
} from './cloudflare-intent.mjs';

/**
 * WHOSE SITE. This used to default to `https://scripthammer.com`, so a fork that had not set
 * `NEXT_PUBLIC_DEPLOY_URL` probed THIS repo's production and reported green about a header it
 * does not serve — the #1014 and #987 shape. There is no literal any more: no base means
 * nothing to check, which is a SKIP.
 */
const site = (process.argv[2] || process.env.SITE || '')
  .trim()
  .replace(/\/+$/, '');

if (!site) {
  console.log(
    '[csp] skipped — no site to check. Set NEXT_PUBLIC_DEPLOY_URL (Settings → Secrets and ' +
      'variables → Actions → Variables) to the site you deploy.'
  );
  process.exit(0);
}

/**
 * Whether a missing CSP is a FAILURE or a note.
 *
 * Defaults off, exactly as `REQUIRE_EDGE` does in `check-cache-headers.mjs` (#970): the CSP
 * here is set by a Cloudflare Transform Rule, and a fork that never had a Cloudflare edge
 * must not be failed for lacking one. `smoke.yml` sets it to `true` for THIS repo, because
 * losing the rule silently is the entire #393 regression this check exists to catch.
 */
const REQUIRE_CSP = /^(1|true|yes)$/i.test(process.env.REQUIRE_CSP ?? '');

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
  const msg =
    'no Content-Security-Policy header on production. The policy is set by a Cloudflare ' +
    'Response Header Transform Rule; if that rule was deleted, the token rotated or the ' +
    'zone moved, the site is back to having no CSP at all (#393). Note a `<meta name>` ' +
    'CSP does NOT count and is what this issue was about.';
  if (REQUIRE_CSP) fail(msg);
  else
    console.log(
      `[csp] ${msg}\n[csp] not failing: REQUIRE_CSP is not set for this deployment.`
    );
  process.exit();
}

if (!cfRay) {
  const msg =
    'a CSP header is present but the response did not come through Cloudflare (no cf-ray). ' +
    'Something else is setting it, so the rule this check exists to guard is unverified.';
  if (REQUIRE_CSP) fail(msg);
  else
    console.log(
      `[csp] ${msg}\n[csp] not failing: REQUIRE_CSP is not set for this deployment.`
    );
}

// Mode drift, in both directions. Gated on REQUIRE_CSP for the same reason the presence
// check is: a fork that serves its own CSP however it likes is not this repo's regression.
const actualMode = enforcing ? 'enforcing' : 'report-only';
if (actualMode !== CSP_MODE) {
  const msg =
    `CSP is delivered as ${actualMode} but this repo declares ${CSP_MODE} ` +
    `(cloudflare-intent.mjs). Expected the header ${intendedCspHeader()}. ` +
    (actualMode === 'enforcing'
      ? 'An undeclared flip to enforcing can break sign-up and checkout silently.'
      : 'The enforcing policy was reverted, so the site is back to observing only.') +
    ' If the change was deliberate, set CSP_MODE in the same commit so the intent is recorded.';
  if (REQUIRE_CSP) fail(msg);
  else
    console.log(
      `[csp] ${msg}\n[csp] not failing: REQUIRE_CSP is not set for this deployment.`
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

/*
 * THE SCHEDULER MUST BE PERMITTED IN EVERY DIRECTIVE IT IS READ FROM (#1110).
 *
 * The check above is a substring match, so `policy.includes('frame-src')` is true whether the
 * origin sits in `frame-src`, in `script-src`, or nowhere near either. That is not a nitpick:
 * #1110 was filed as a `frame-src` problem and production was violating BOTH directives, so a
 * frame-src-shaped assertion would have been satisfied by a fix that still blanked the booker.
 *
 * The origins come from `cloudflare-intent.mjs`, the same module `cloudflare-apply.mjs` writes
 * from — one source, so the checker and the change cannot disagree. A second hand-maintained
 * list here is the drift this repo keeps paying for.
 *
 * Report-only means a violation costs nothing today; it costs an outage the moment #393 flips.
 * So this fails on the missing origin NOW, while the failure is free.
 */
const parsed = new Map(
  policy
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const [name, ...sources] = d.split(/\s+/);
      return [name.toLowerCase(), sources];
    })
);

const provider = calendarProvider();
const origins = SCHEDULER_ORIGINS[provider] ?? [];
if (!origins.length) {
  console.log(`scheduler       : ${provider} (no origins declared — not checked)`);
} else {
  const gaps = [];
  for (const directive of SCHEDULER_DIRECTIVES) {
    const sources = parsed.get(directive) ?? [];
    for (const origin of origins) {
      if (!sources.includes(origin)) gaps.push(`${directive} is missing ${origin}`);
    }
  }
  if (gaps.length && !REQUIRE_CSP) {
    // Same gating as the presence check above, and for the same reason: a fork that has not
    // opted into a managed CSP must not be failed for a policy it did not author. It still
    // gets told, because the consequence — booking blocked the moment they enforce — is
    // exactly what they would otherwise discover in production.
    console.log(
      `scheduler       : ${provider} NOT permitted (${gaps.join('; ')})\n` +
        `[csp] not failing: REQUIRE_CSP is not set for this deployment.`
    );
  } else if (gaps.length) {
    fail(
      `the CSP does not permit the ${provider} scheduler: ${gaps.join('; ')}. ` +
        `Enforcing this policy would break booking — the embed loads a SCRIPT and opens an ` +
        `IFRAME, so it must appear in both directives (#1110). Run ` +
        `\`NEXT_PUBLIC_CALENDAR_PROVIDER=${provider} node scripts/ci/cloudflare-apply.mjs --only=csp\` ` +
        `to see the diff, then re-run with --apply.`
    );
  } else {
    console.log(
      `scheduler       : ${provider} permitted in ${SCHEDULER_DIRECTIVES.join(' + ')}`
    );
  }
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
