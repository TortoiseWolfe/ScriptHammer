#!/usr/bin/env node
// CAPTCHA preflight gate (#353).
//
// WHY THIS EXISTS
// `SECURITY_CAPTCHA_ENABLED` in Supabase is GLOBAL to auth. It gates sign-in,
// password recovery and resend — not just sign-up. Flipping it while any link
// in the chain is wrong locks every existing user out of the product. That
// happened once already: the flag went on while only the sign-up form sent a
// token, and every sign-in started failing with "captcha protection: request
// disallowed (no captcha_token found)".
//
// The lesson was not "be more careful". It was that the flip was verified by
// probing sign-UP, the one path that happened to work. This script checks every
// link that has to hold, so the answer does not depend on which page someone
// thought to open.
//
// WHAT IT CHECKS
//   1. The site key is actually in the deployed HTML/JS (NEXT_PUBLIC_* is
//      inlined at BUILD time — a repo variable alone changes nothing).
//   2. The deployed origin is on the widget's allowed-domains list, proven
//      DIFFERENTIALLY: a bogus origin must be rejected with 110200 while the
//      real origin must not be. Without the bogus control, "no error" is
//      unfalsifiable — it also happens when the check itself is broken.
//   3. The secret is a real Turnstile secret, via Cloudflare's siteverify.
//      Supabase returns write-only secrets as SHA-256 HASHES on read-back
//      (`smtp_pass` and the OAuth secrets look identical), so the stored value
//      CANNOT be validated by reading it. The plaintext must be supplied.
//
// WHAT IT DELIBERATELY DOES NOT CHECK
// Whether Cloudflare issues a token to THIS client. Turnstile exists to
// withhold tokens from automated browsers, so a headless run in a datacenter
// legitimately gets none. Treating that as failure would make the gate
// permanently red; treating it as success would make it meaningless. It is out
// of scope, and the checks above are the ones that actually fail silently.
//
// USAGE
//   TURNSTILE_SECRET=0x... node scripts/check-captcha.mjs
//   ... --base https://scripthammer.com --site-key 0x4AAA...
//
// EXIT CODES
//   0  every verifiable link holds — safe to enable
//   1  a link is broken — DO NOT enable
//   2  could not run the check (missing input, network)

const VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/**
 * WHOSE SITE (#1054). This defaulted to `https://scripthammer.com`, so a fork running the
 * preflight probed THIS repo's deployed bundle and reported on a site it does not own — and
 * this script's exit 0 is an AUTHORIZATION ("safe to enable") for a change that is global to
 * Supabase auth. It locked every user out once already, per the header above.
 *
 * There is no literal any more, and unlike the post-deploy checks this one REFUSES rather than
 * skipping: the fitting precedent is `check-cache-headers.mjs` (#970), not `check-csp-header.mjs`.
 * A skip here would print a reassuring line at the exact moment an operator is deciding whether
 * to flip a destructive switch. Nothing may read this script's silence as consent.
 *
 * Code 2, not 1, matching the convention above and the sibling SITE_KEY guard below: this is
 * "could not run the check", not "a link is broken".
 */
const BASE = (arg('base', process.env.CHECK_BASE) || '')
  .trim()
  .replace(/\/$/, '');

if (!BASE) {
  console.error(
    'check-captcha: no site to check.\n' +
      '  Pass --base https://your-site, or set CHECK_BASE in the environment.\n' +
      '  Refusing rather than defaulting: exit 0 from this script authorises enabling a\n' +
      '  captcha globally across sign-in, recovery and resend, so it must never be reported\n' +
      '  against a site you did not name.'
  );
  process.exit(2);
}
const SITE_KEY = arg('site-key', process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY);
const SECRET = process.env.TURNSTILE_SECRET;

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}\n     ${detail}`);
};

if (!SITE_KEY) {
  console.error(
    'check-captcha: no site key.\n' +
      '  Pass --site-key, or set NEXT_PUBLIC_CAPTCHA_SITE_KEY in the environment.'
  );
  process.exit(2);
}

// --- 1. site key reached the deployed bundle -------------------------------
// The value is inlined into a JS chunk at build time, so it will not be in the
// page HTML. Fetch the page, then the chunks it references.
try {
  const html = await fetch(`${BASE}/sign-in/`).then((r) => r.text());
  let found = html.includes(SITE_KEY);
  if (!found) {
    const chunks = [...html.matchAll(/src="([^"]+\.js)"/g)]
      .map((m) => m[1])
      .slice(0, 40);
    for (const c of chunks) {
      const url = c.startsWith('http')
        ? c
        : `${BASE}${c.startsWith('/') ? '' : '/'}${c}`;
      const body = await fetch(url)
        .then((r) => r.text())
        .catch(() => '');
      if (body.includes(SITE_KEY)) {
        found = true;
        break;
      }
    }
  }
  record(
    'site key is in the deployed build',
    found,
    found
      ? `${SITE_KEY} is served by ${BASE}`
      : `${SITE_KEY} is NOT in the deployed bundle — the build did not receive ` +
          `NEXT_PUBLIC_CAPTCHA_SITE_KEY. A repo variable alone does nothing; the ` +
          `workflow must pass it into the build step.`
  );
} catch (err) {
  record(
    'site key is in the deployed build',
    false,
    `could not fetch ${BASE}: ${err.message}`
  );
}

// --- 2. secret is a real Turnstile secret ----------------------------------
// siteverify distinguishes the two failure modes precisely:
//   invalid-input-secret   -> the SECRET is wrong (users would be locked out)
//   invalid-input-response -> the secret is VALID, the dummy token is not
// The second is the result we want; it is the only proof the secret is real
// without solving a live challenge.
if (!SECRET) {
  record(
    'secret is a valid Turnstile secret',
    false,
    'TURNSTILE_SECRET is not set, so the secret could not be checked. Supabase ' +
      'returns it as a SHA-256 hash, so reading it back proves nothing. Supply ' +
      'the plaintext from https://dash.cloudflare.com/?to=/:account/turnstile'
  );
} else {
  try {
    const body = new URLSearchParams({
      secret: SECRET,
      response: 'dummy-token',
    });
    const res = await fetch(VERIFY, { method: 'POST', body }).then((r) =>
      r.json()
    );
    const codes = res['error-codes'] ?? [];
    const secretOk = !codes.includes('invalid-input-secret');
    record(
      'secret is a valid Turnstile secret',
      secretOk,
      secretOk
        ? `Cloudflare accepted the secret (rejected only the dummy token: ${JSON.stringify(codes)})`
        : `Cloudflare rejected the SECRET itself (${JSON.stringify(codes)}). Enabling ` +
            `CAPTCHA with this secret refuses EVERY auth request, even with a valid token.`
    );
  } catch (err) {
    record(
      'secret is a valid Turnstile secret',
      false,
      `siteverify unreachable: ${err.message}`
    );
  }
}

// --- report ----------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log();
if (failed.length) {
  console.log(
    `❌ ${failed.length}/${results.length} check(s) failed — DO NOT enable CAPTCHA.`
  );
  process.exit(1);
}
console.log(
  `✅ ${results.length}/${results.length} checks passed.\n` +
    '   Domain allowlisting is verified separately by the browser differential\n' +
    '   probe (bogus origin must return 110200); see docs/AUTH-SETUP.md.'
);
process.exit(0);
