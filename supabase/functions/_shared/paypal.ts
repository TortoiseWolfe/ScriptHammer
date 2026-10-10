/**
 * PayPal OAuth2 client-credentials token, shared by every PayPal Edge Function (#1260).
 *
 * Five functions each carried their own copy, and they had drifted:
 * create-paypal-subscription's defaulted a missing client id or secret to '' (with a
 * NEXT_PUBLIC_ fallback for the id), so it sent `Basic base64(":")` to PayPal instead
 * of refusing, and no copy checked that a 200 actually carried a token. This one fails
 * closed on both. A fix to how a client secret becomes a bearer token now lands once.
 *
 * NOTHING IMPORTED AND NO `Deno` GLOBAL, so Vitest can exercise it from tests/unit.
 * Callers pass the API base they already use for their own PayPal calls and an env
 * reader, `(name) => Deno.env.get(name)`.
 */

export type EnvReader = (name: string) => string | undefined;

export async function getPayPalAccessToken(
  apiBase: string,
  readEnv: EnvReader,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const clientId = readEnv('PAYPAL_CLIENT_ID');
  const clientSecret = readEnv('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error(
      'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in function env'
    );
  }

  const res = await fetchImpl(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PayPal token request failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { access_token?: unknown };
  if (typeof json.access_token !== 'string' || json.access_token === '') {
    throw new Error('PayPal token response carried no access_token');
  }
  return json.access_token;
}
