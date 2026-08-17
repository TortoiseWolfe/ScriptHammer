import {
  ContactFormData,
  EmailProvider,
  EmailResult,
  EmailProviderError,
} from '../types';

/**
 * Deliver contact-form mail through this project's own Supabase Edge Function,
 * which sends via Resend (#784).
 *
 * WHY IT EXISTS AND WHY IT IS FIRST. Production shipped an EMPTY
 * `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`, so the Web3Forms provider threw on every
 * submission and `/contact/` delivered nothing — while Stripe's `support_url`
 * pointed paying customers at that page.
 *
 * Resend is already the mail path this project owns: the domain is verified, DKIM
 * and SPF are live, and `RESEND_API_KEY` is already an Edge Function secret. Using
 * it removes a third-party dependency and one more credential nobody was watching.
 * Web3Forms stays registered behind this as a genuine fallback, so a fork that
 * prefers it — or has no Supabase — still works.
 *
 * THE RECIPIENT IS NOT SENT FROM THE BROWSER. The Edge Function reads it from
 * server-side configuration and ignores anything the client supplies. An endpoint
 * that accepts a caller-chosen `to` is an open relay, and this project has already
 * had a form abused to mail non-consenting third parties (#353).
 */

const FUNCTION_PATH = '/functions/v1/contact-message';

function endpoint(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}${FUNCTION_PATH}`;
}

export class SupabaseResendProvider implements EmailProvider {
  name = 'SupabaseResend';
  /**
   * 0 — ahead of Web3Forms (1) and EmailJS (2). Lower is tried first; this is the
   * path we control end to end.
   */
  priority = 0;

  async isAvailable(): Promise<boolean> {
    return Boolean(endpoint());
  }

  async send(data: ContactFormData): Promise<EmailResult> {
    const url = endpoint();
    if (!url) {
      throw new EmailProviderError(
        'NEXT_PUBLIC_SUPABASE_URL is not set, so the contact function has no address',
        this.name
      );
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The anon key is public by design and is what the gateway expects.
          // Absent it, Supabase answers 401 before the function ever runs.
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        }),
      });
    } catch (error) {
      // A network failure must surface as a provider error so the service fails
      // over rather than reporting a send that never happened.
      throw new EmailProviderError(
        'Could not reach the contact function',
        this.name,
        error
      );
    }

    const result = await response
      .json()
      .catch(() => ({}) as Record<string, unknown>);

    if (!response.ok || result?.success !== true) {
      throw new EmailProviderError(
        typeof result?.error === 'string'
          ? result.error
          : `Contact function returned ${response.status}`,
        this.name,
        result
      );
    }

    return {
      success: true,
      provider: this.name,
      messageId: typeof result?.id === 'string' ? result.id : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  async validateConfig(): Promise<boolean> {
    return Boolean(endpoint());
  }
}
