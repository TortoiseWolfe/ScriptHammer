/**
 * The one PayPal token helper every PayPal Edge Function imports (#1260).
 *
 * Five functions each carried a copy and they had drifted. create-paypal-subscription's
 * defaulted a missing client id or secret to '' (with a NEXT_PUBLIC_ fallback for the id),
 * so it sent `Basic base64(":")` to PayPal instead of refusing. No copy checked that a 200
 * actually carried a token. These cases pin the fail-closed behaviour.
 */
import { describe, it, expect, vi } from 'vitest';
import { getPayPalAccessToken } from '../../supabase/functions/_shared/paypal';

const API = 'https://api-m.sandbox.paypal.com';

const CREDS: Record<string, string> = {
  PAYPAL_CLIENT_ID: 'client-id',
  PAYPAL_CLIENT_SECRET: 'client-secret',
};

function envOf(vars: Record<string, string>) {
  return (name: string): string | undefined => vars[name];
}

function tokenEndpoint(status: number, body: unknown) {
  return vi.fn(async (url: string, init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
}

describe('getPayPalAccessToken (#1260)', () => {
  it('posts a client-credentials grant with Basic auth and returns the token', async () => {
    const fetchMock = tokenEndpoint(200, { access_token: 'A21AA-token' });

    const token = await getPayPalAccessToken(
      API,
      envOf(CREDS),
      fetchMock as unknown as typeof fetch
    );

    expect(token).toBe('A21AA-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/oauth2/token`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('grant_type=client_credentials');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Basic ' + btoa('client-id:client-secret')
    );
  });

  it.each([
    ['the client id', { PAYPAL_CLIENT_SECRET: 'client-secret' }],
    ['the client secret', { PAYPAL_CLIENT_ID: 'client-id' }],
    ['both', {}],
  ])('refuses without calling PayPal when %s is missing', async (_l, vars) => {
    const fetchMock = tokenEndpoint(200, { access_token: 'never' });

    await expect(
      getPayPalAccessToken(
        API,
        envOf(vars as Record<string, string>),
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toThrow(
      'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in function env'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fall back to NEXT_PUBLIC_PAYPAL_CLIENT_ID', async () => {
    const fetchMock = tokenEndpoint(200, { access_token: 'never' });

    await expect(
      getPayPalAccessToken(
        API,
        envOf({
          NEXT_PUBLIC_PAYPAL_CLIENT_ID: 'public-id',
          PAYPAL_CLIENT_SECRET: 'client-secret',
        }),
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toThrow('missing in function env');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws with the status when PayPal refuses the credentials', async () => {
    const fetchMock = tokenEndpoint(401, { error: 'invalid_client' });

    await expect(
      getPayPalAccessToken(
        API,
        envOf(CREDS),
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toThrow('PayPal token request failed (401)');
  });

  it.each([
    ['no access_token', {}],
    ['an empty access_token', { access_token: '' }],
    ['a non-string access_token', { access_token: 42 }],
  ])('refuses a 200 that carries %s', async (_l, body) => {
    const fetchMock = tokenEndpoint(200, body);

    await expect(
      getPayPalAccessToken(
        API,
        envOf(CREDS),
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toThrow('PayPal token response carried no access_token');
  });
});
