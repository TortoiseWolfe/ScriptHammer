/**
 * The Cloudflare-resident configuration this repository intends (#393, #822, #635).
 *
 * WHY A SEPARATE MODULE. Three controls that carry real security weight live in a dashboard
 * rather than in this tree: the cache headers, the CSP header, and the mail DNS. `CLAUDE.md`
 * says it plainly — "the Cloudflare rules live in a dashboard rather than this repo — delete
 * one, rotate the token or move the zone and production silently returns to `max-age=600`."
 *
 * Each of those has a CHECKER that asserts production still matches. What none of them had
 * was a place to say what the intent IS, independent of the code that verifies it, so that
 * the same value can drive both the check and the change. Without that, tightening a policy
 * means editing a dashboard by hand and then editing a checker to agree — two steps, in two
 * systems, with nothing catching a half-done pair.
 *
 * So the intent lives here, once. `check-csp-header.mjs` asserts production matches it, and
 * `cloudflare-apply.mjs` makes production match it. Changing policy is then a one-line diff
 * in a reviewed commit, which is exactly the pattern `check-mail-policy.mjs` already uses for
 * DMARC — see its header for why that is the point rather than an implementation detail.
 *
 * THIS FILE DESCRIBES INTENT, NOT IDENTITY. There are deliberately no zone ids, ruleset ids
 * or rule ids here. Those are discovered at runtime by name and by content, because a fork
 * has different ones and a hardcoded id is the #1014 / #987 failure — template defaults
 * quietly pointing a fork's tooling at the template's infrastructure.
 */

/**
 * Whether the CSP is delivered as a REPORT-ONLY header or an ENFORCING one.
 *
 * `report-only` is deliberate and currently correct. #393 shipped it that way on purpose:
 * enforcing an untested policy breaks sign-up and checkout SILENTLY, and `js.stripe.com`
 * loads both a script and an iframe on `/checkout/` while appearing in neither directive
 * before that work. Report-only is how the missing origins get discovered without an outage.
 *
 * TO FLIP IT: change this to 'enforcing', run `cloudflare-apply.mjs --apply`, and land both
 * in one commit. The checker then requires the enforcing header, so a dashboard revert fails
 * CI instead of passing quietly.
 *
 * Do not flip it without evidence. The header is delivered; whether every origin the site
 * needs is ALLOWED is a different question, and report-only mode is what answers it.
 */
export const CSP_MODE = 'report-only';

/** The response header name each mode is delivered under. */
export const CSP_HEADER = {
  'report-only': 'Content-Security-Policy-Report-Only',
  enforcing: 'Content-Security-Policy',
};

/** The header a CSP rule might be delivered under, in either mode. */
export const CSP_HEADER_NAMES = Object.values(CSP_HEADER);

export function intendedCspHeader(mode = CSP_MODE) {
  const name = CSP_HEADER[mode];
  if (!name)
    throw new Error(
      `unknown CSP mode: ${mode} (expected one of ${Object.keys(CSP_HEADER).join(', ')})`
    );
  return name;
}

/* ------------------------------------------------------------------ the policy itself ---- */

/**
 * THE POLICY, AS DIRECTIVES RATHER THAN A STRING (#1110).
 *
 * Until now the only copy of the live policy was the Cloudflare rule value. `planCsp` could
 * rename the header key and nothing more, so adding an origin meant a human editing a
 * dashboard — unreviewable, unversioned, and invisible to `git log`. That is the gap this
 * module's header promises to close: "the same value can drive both the check and the change".
 *
 * Captured VERBATIM from production on 2026-09-09 before anything was added, and
 * `scripts/__tests__/csp-intent-round-trips.test.js` pins that `cspPolicy(null)` still
 * serialises to exactly that 951-character string. So this restructuring provably changed
 * nothing; the scheduler origins below are the only intended difference.
 *
 * Order is load-bearing for that byte-comparison — object key order is insertion order.
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://challenges.cloudflare.com',
    'https://static.cloudflareinsights.com',
    'https://js.stripe.com',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    'https://unpkg.com',
    'https://fonts.googleapis.com',
  ],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'connect-src': [
    "'self'",
    'https://www.googleapis.com',
    'https://*.google-analytics.com',
    'https://tile.openstreetmap.org',
    'https://*.tile.openstreetmap.org',
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.basemaps.cartocdn.com',
    'https://api.web3forms.com',
    'https://*.ingest.sentry.io',
    'https://*.ingest.us.sentry.io',
    'https://challenges.cloudflare.com',
    'https://static.cloudflareinsights.com',
  ],
  'frame-src': [
    "'self'",
    'https://www.google.com',
    'https://challenges.cloudflare.com',
    'https://js.stripe.com',
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'", 'https://api.web3forms.com'],
  'frame-ancestors': ["'none'"],
};

/**
 * Where each scheduler is actually served from — and it is NOT the configured booking URL.
 *
 * `NEXT_PUBLIC_CALENDAR_URL` is `https://cal.com/<user>/<event>`, so deriving the origin from
 * it yields `https://cal.com` — which is WRONG and would leave the policy still blocking the
 * embed. `@calcom/embed-react` hardcodes `https://app.cal.com/embed/embed.js` (`Cal.es.mjs:3`)
 * and the booker iframe is served from that same host, so `app.cal.com` is the origin whatever
 * the configured link says. Measured on production 2026-09-09: the browser reported violations
 * for `https://app.cal.com/embed/embed.js` (script-src) and `Framing 'https://app.cal.com/'`
 * (frame-src), and for nothing else.
 *
 * TWO DIRECTIVES, NOT ONE. #1110 was filed as a `frame-src` problem. Adding only that would
 * permit the iframe and still block the script that creates it — the same shape as
 * `js.stripe.com`, which loads a script AND an iframe on `/checkout/` and appeared in neither
 * directive before #393. `connect-src` deliberately gets nothing: the embed's tRPC traffic is
 * issued by the iframe document under Cal.com's own policy, and no `connect-src` violation is
 * reported.
 */
export const SCHEDULER_ORIGINS = {
  calcom: ['https://app.cal.com'],
  calendly: ['https://calendly.com', 'https://assets.calendly.com'],
};

/** The directives the scheduler needs to be listed in. */
export const SCHEDULER_DIRECTIVES = ['script-src', 'frame-src'];

/**
 * The provider this deployment actually uses.
 *
 * Defaults to `calendly` to match `src/config/calendar.config.ts:36-38`, so a fork that sets
 * nothing gets the same answer from both. Only the CONFIGURED provider's origins are added —
 * permitting both would widen a live policy for a scheduler the site does not embed.
 */
export function calendarProvider(env = process.env) {
  return env.NEXT_PUBLIC_CALENDAR_PROVIDER || 'calendly';
}

/** The directives, with the configured scheduler's origins merged in. `null` = base only. */
export function cspDirectives(provider = calendarProvider()) {
  const origins = provider === null ? [] : (SCHEDULER_ORIGINS[provider] ?? []);
  const out = {};
  for (const [name, sources] of Object.entries(CSP_DIRECTIVES)) {
    out[name] = SCHEDULER_DIRECTIVES.includes(name)
      ? [...sources, ...origins.filter((o) => !sources.includes(o))]
      : [...sources];
  }
  return out;
}

/** The policy as a header value. */
export function cspPolicy(provider = calendarProvider()) {
  return Object.entries(cspDirectives(provider))
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}
