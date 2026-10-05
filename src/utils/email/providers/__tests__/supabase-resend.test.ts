/**
 * The Supabase+Resend provider is what makes `/contact/` work without a
 * third-party key (#784). Production shipped an empty `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`,
 * so the only registered provider threw on every submission and the page delivered
 * nothing — while Stripe pointed paying customers at it.
 *
 * The assertions that matter here are the negative ones: that a failure is reported
 * as a failure. A contact provider which resolves successfully while delivering
 * nothing is strictly worse than one that throws, because it silently eats enquiries.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupabaseResendProvider } from '../supabase-resend';
import {
  EmailDeliveryUnknownError,
  EmailProviderError,
  EmailRefusedError,
} from '../../types';

const DATA = {
  name: 'Ada',
  email: 'ada@example.com',
  subject: 'Hello',
  message: 'Testing',
};

const originalEnv = process.env;

describe('SupabaseResendProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('is unavailable when no Supabase URL is configured, so the service fails over', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    // A fork without Supabase must fall through to Web3Forms rather than have this
    // provider claim it can send and then fail.
    expect(await new SupabaseResendProvider().isAvailable()).toBe(false);
  });

  it('is available once the URL exists', async () => {
    expect(await new SupabaseResendProvider().isAvailable()).toBe(true);
  });

  it('posts to the contact function and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, id: 'msg_123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new SupabaseResendProvider().send(DATA);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg_123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/functions/v1/contact-message');

    // The browser must NOT be able to name the recipient — the function reads it
    // server-side. If a `to` ever appears in this payload, the endpoint has become
    // an open relay (#353).
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty('to');
    expect(body).not.toHaveProperty('CONTACT_TO');
    expect(body).toMatchObject({ name: 'Ada', email: 'ada@example.com' });
  });

  it('THROWS when the function reports a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Contact delivery is not configured' }),
      })
    );

    await expect(new SupabaseResendProvider().send(DATA)).rejects.toThrow(
      EmailProviderError
    );
  });

  it('THROWS when the response is 200 but does not confirm success', async () => {
    // The failure mode worth guarding: a proxy or gateway returning 200 with a body
    // that is not a delivery confirmation. Treating that as sent loses the enquiry.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'queued somewhere, maybe' }),
      })
    );

    await expect(new SupabaseResendProvider().send(DATA)).rejects.toThrow(
      EmailProviderError
    );
  });

  it('THROWS on a network failure rather than resolving', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(new SupabaseResendProvider().send(DATA)).rejects.toThrow(
      EmailProviderError
    );
  });

  // (#1319) The function checks the token with Cloudflare when TURNSTILE_SECRET is
  // set. Dropped here, every submission from a page with the widget is refused.
  it('forwards the Turnstile token, and sends no key at all without one', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, id: 'msg_1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new SupabaseResendProvider().send({ ...DATA, captchaToken: 'tok-1' });
    await new SupabaseResendProvider().send(DATA);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).captchaToken).toBe(
      'tok-1'
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty(
      'captchaToken'
    );
  });

  // A refusal must be distinguishable from a broken provider, or EmailService
  // retries it and fails over to a provider that skips the check (#1319).
  it.each([400, 403, 429])(
    'reports a %i as a REFUSAL carrying the function’s own message',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({ error: 'Please complete the challenge.' }),
        })
      );

      const failure = await new SupabaseResendProvider()
        .send(DATA)
        .catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(EmailRefusedError);
      expect((failure as EmailRefusedError).status).toBe(status);
      expect((failure as Error).message).toBe('Please complete the challenge.');
    }
  );

  // 401 is the gateway refusing OUR anon key: a configuration fault, not a verdict
  // on the visitor, and a fallback provider may well survive it.
  it.each([401, 500, 502, 503])(
    'reports a %i as an ordinary provider failure, not a refusal',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({ error: 'nope' }),
        })
      );

      const failure = await new SupabaseResendProvider()
        .send(DATA)
        .catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(EmailProviderError);
      expect(failure).not.toBeInstanceOf(EmailRefusedError);
      // The function's own JSON answer means it did not send, so failover stays
      // allowed (#1322).
      expect(failure).not.toBeInstanceOf(EmailDeliveryUnknownError);
    }
  );

  // (#1322) "Did it send?" has three answers, and only a definite NO may fail over:
  // the next provider cannot recognise a copy, so the visitor would get a duplicate.
  describe('outcomes that cannot be read as "not sent"', () => {
    it('no response at all (the request may have arrived and sent)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('reset')));

      await expect(new SupabaseResendProvider().send(DATA)).rejects.toThrow(
        EmailDeliveryUnknownError
      );
    });

    it('a 409: the first send of this text is still in flight', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({ error: 'still sending' }),
        })
      );

      await expect(new SupabaseResendProvider().send(DATA)).rejects.toThrow(
        EmailDeliveryUnknownError
      );
    });

    it.each([502, 504])(
      'a gateway %i without the function’s JSON (it may have run)',
      async (status) => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: false,
            status,
            json: async () => {
              throw new SyntaxError('<html>');
            },
          })
        );

        await expect(new SupabaseResendProvider().send(DATA)).rejects.toThrow(
          EmailDeliveryUnknownError
        );
      }
    );

    it('a 200 that is not the function’s confirmation', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ message: 'captive portal' }),
        })
      );

      await expect(new SupabaseResendProvider().send(DATA)).rejects.toThrow(
        EmailDeliveryUnknownError
      );
    });
  });

  it('treats the function’s duplicate answer as delivered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, id: null, duplicate: true }),
      })
    );

    const result = await new SupabaseResendProvider().send(DATA);
    expect(result.success).toBe(true);
    expect(result.messageId).toBeUndefined();
  });
});
