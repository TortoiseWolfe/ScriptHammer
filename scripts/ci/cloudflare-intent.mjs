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
 * Captured VERBATIM from production on 2026-09-09 before anything was added, so this
 * restructuring provably changed nothing; the scheduler origins below are the only
 * intended difference.
 *
 * This used to cite `scripts/__tests__/csp-intent-round-trips.test.js` as pinning the
 * serialisation to exactly that 951-character string. THAT FILE HAS NEVER EXISTED, so
 * the byte-comparison it promised was asserted nowhere — a #396-shaped claim sitting in
 * the module whose whole job is to be the single source of truth. The pin now lives in
 * `cloudflare-apply.mjs`'s inline `selftest()`, which CI genuinely runs via
 * `cloudflare-apply-fork-safe.test.js`.
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
    // OpenAI Ads measurement pixel. Loaded only with MARKETING consent (FR-026) by
    // src/lib/analytics/OpenAIPixel — but the declared policy must permit it regardless,
    // because a CSP is not per-visitor. Production sends this report-only (#393), so an
    // omission here would not have failed loudly.
    'https://bzrcdn.openai.com',
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

/* ------------------------------------------------- the cache contract (#635, #1199) ---- */

/** Documents are never under this prefix; Next.js build output always is. */
export const NEXT_PREFIX = '/_next/';

/** Where content-hashed output lives. The filename IS the version. */
export const HASHED_ASSET_PREFIX = '/_next/static/';

/** One year — the #635 Cache Rule's browser and edge default for hashed assets. */
export const ASSET_MAX_AGE = 31536000;

/** What a document, and now an error response, must carry so a browser re-asks. */
export const REVALIDATE_CACHE_CONTROL = 'no-cache';

/**
 * Error classes, and how long the EDGE may keep each (#1199).
 *
 * ONE DECLARATION, TWO SERIALISERS. `errorExpression()` turns this into the wirefilter
 * clause that widens the response-header rule, and `edgeStatusCodeTtl()` turns the same
 * array into Cloudflare's `status_code_ttl` shape. Neither is written by hand, so the
 * browser half and the edge half provably cover the same set of codes — which is the
 * entire reason to declare this rather than edit two dashboard fields.
 *
 * 60 and 30 rather than 0 (no-cache) or -1 (no-store): briefly absorbing a burst of
 * requests for a missing path is the useful half of caching an error, and collapsing it
 * entirely hands every 404 straight to the origin. The defect in #1199 was duration —
 * four hours on an asset path, a YEAR under /_next/static/ — not the caching itself.
 */
export const CACHE_ERROR_TTLS = [
  { from: 404, to: 404, edgeTtl: 60 },
  { from: 500, to: 599, edgeTtl: 30 },
];

/**
 * The condition matching a DOCUMENT response.
 *
 * Captured verbatim from the live rule on 2026-09-22 and re-derived here so that
 * `revalidateExpression(null)` reproduces it byte for byte. The selftest pins that
 * equality, which is what makes #1199's widening provably a no-op for #635: reverting
 * it is deleting one argument, not re-deriving an expression from memory.
 */
export function documentExpression() {
  return (
    `(ends_with(http.request.uri.path, "/") or ` +
    `ends_with(http.request.uri.path, ".html")) and ` +
    `not starts_with(http.request.uri.path, "${NEXT_PREFIX}")`
  );
}

/** The condition matching an ERROR response, from the same array as the edge TTLs. */
export function errorExpression(ranges = CACHE_ERROR_TTLS) {
  return ranges
    .map(({ from, to }) =>
      from === to
        ? `http.response.code == ${from}`
        : `(http.response.code >= ${from} and http.response.code <= ${to})`
    )
    .join(' or ');
}

/**
 * The full expression for the rule that sets `cache-control: no-cache`.
 *
 * `ranges === null` yields the document half alone — the #635 rule exactly as it stood
 * before #1199, which is what the round-trip pin compares against.
 */
export function revalidateExpression(ranges = CACHE_ERROR_TTLS) {
  const doc = documentExpression();
  if (ranges === null) return doc;
  return `(${doc}) or (${errorExpression(ranges)})`;
}

/**
 * Cloudflare's per-status edge TTL shape.
 *
 * `status_code_range` rather than a bare `status_code` key: every example in
 * Cloudflare's documentation uses the range form, and a single-code rule is expressed
 * as `{from: 404, to: 404}`. This exists only under `edge_ttl` — there is no per-status
 * BROWSER TTL, which is why the browser half of #1199 has to be a response-header rule.
 */
export function edgeStatusCodeTtl(ranges = CACHE_ERROR_TTLS) {
  return ranges.map(({ from, to, edgeTtl }) => ({
    status_code_range: { from, to },
    value: edgeTtl,
  }));
}

/** Descriptions the planners match rules by, and write back on update. */
export const CACHE_DESCRIPTIONS = {
  revalidate:
    '#635/#1199: documents and error responses must revalidate - a document is the ' +
    'index of which assets to load, and a cached miss outlives the deploy that fixes it',
  asset:
    '#635: hashed assets are immutable - the filename IS the version, and #1199: an ' +
    'error under that prefix must not inherit the one-year override',
};

/** The whole cache contract, frozen, as one override point for the planners. */
export function cacheIntent(ranges = CACHE_ERROR_TTLS) {
  return Object.freeze({
    revalidateExpression: revalidateExpression(ranges),
    revalidateCacheControl: REVALIDATE_CACHE_CONTROL,
    hashedAssetPrefix: HASHED_ASSET_PREFIX,
    assetMaxAge: ASSET_MAX_AGE,
    statusCodeTtl: edgeStatusCodeTtl(ranges),
    descriptions: CACHE_DESCRIPTIONS,
  });
}
