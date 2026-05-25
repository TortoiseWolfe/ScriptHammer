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

const ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  'x-client-info',
  'apikey',
].join(', ');

const ALLOWED_METHODS = ['POST', 'OPTIONS'].join(', ');

/**
 * Build CORS headers. Echoes the request's Origin if allowed; otherwise
 * falls back to the configured site URL. Wildcards are deliberately
 * avoided — these functions move money.
 */
export function corsHeaders(req: Request): HeadersInit {
  const requestOrigin = req.headers.get('origin') ?? '';
  const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? '';

  // Allow the configured site, plus localhost dev (3000/3001) for ScriptHammer.
  const allowed = [
    siteUrl,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);

  const origin = allowed.includes(requestOrigin) ? requestOrigin : siteUrl;

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
