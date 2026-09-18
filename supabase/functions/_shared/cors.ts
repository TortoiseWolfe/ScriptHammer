/**
 * Shared CORS helpers for outbound payment Edge Functions.
 *
 * Used by:
 *   - create-stripe-checkout
 *   - verify-stripe-session
 *   - create-stripe-subscription
 *   - create-paypal-order
 *   - capture-paypal-order
 *   - create-paypal-subscription
 *   - cancel-subscription
 *   - resume-subscription
 *
 * Allowed origins are restricted to the configured site URL. Stripe and
 * PayPal don't need CORS access (server-to-server); only the browser
 * fetches these functions.
 */

/**
 * Every header the BROWSER is permitted to send to these functions.
 *
 * A header a function REQUIRES but does not list here is unreachable from a browser: the
 * preflight succeeds, the response omits the header from Access-Control-Allow-Headers, and the
 * browser then refuses to send the real request. fetch() rejects with `TypeError: Failed to
 * fetch` — no status, no body, nothing in the function's logs, because the POST never happened.
 *
 * THAT IS EXACTLY WHAT HAPPENED. `idempotency-key` was missing while create-order documents it
 * in its own contract (create-order/index.ts:8), reads it (create-order/resolve.ts) and enforces
 * replay protection on it, and both callers send it — src/app/checkout/page.tsx:221 and
 * src/lib/offline-queue/payment-adapter.ts:200. So /checkout could never complete a purchase
 * from a browser, on the first real attempt after go-live.
 *
 * It was invisible to every server-side check because curl does not enforce CORS: the preflight
 * returns 204 with correct-looking headers, and the POST succeeds when you send it yourself.
 * Only a browser refuses. Guarded by scripts/__tests__/cors-allows-what-clients-send.test.js.
 */
export const ALLOWED_HEADER_LIST = [
  'authorization',
  'content-type',
  'x-client-info',
  'apikey',
  'idempotency-key',
];

const ALLOWED_HEADERS = ALLOWED_HEADER_LIST.join(', ');

const ALLOWED_METHODS = ['POST', 'OPTIONS'].join(', ');

/**
 * Build CORS headers. Echoes the request's Origin if allowed; otherwise
 * falls back to the configured site URL. Wildcards are deliberately
 * avoided — these functions move money.
 */
export function corsHeaders(req: Request): HeadersInit {
  const requestOrigin = req.headers.get('origin') ?? '';
  const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? '';

  // NEXT_PUBLIC_SITE_URL may carry a basePath (GitHub Pages project site,
  // e.g. https://user.github.io/ScriptHammer) because the checkout functions
  // build success_url from it — but a browser Origin header is always
  // scheme://host[:port], so compare against the URL's origin only.
  let siteOrigin = '';
  try {
    siteOrigin = siteUrl ? new URL(siteUrl).origin : '';
  } catch {
    siteOrigin = '';
  }

  // Allow the configured site, plus localhost dev (3000/3001) for ScriptHammer.
  const allowed = [
    siteOrigin,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);

  const origin = allowed.includes(requestOrigin) ? requestOrigin : siteOrigin;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * Handle a CORS preflight request. Returns a 204 response if the request
 * is a preflight (OPTIONS), otherwise returns null so the caller can
 * proceed with normal request handling.
 */
export function handleCors(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

/**
 * Convenience: build a JSON response with CORS headers already set.
 */
export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}
