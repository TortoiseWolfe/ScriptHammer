export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  /**
   * A Turnstile token, when the page rendered the widget (#1319). Only the
   * Supabase provider forwards it; the contact function checks it with
   * Cloudflare when `TURNSTILE_SECRET` is set.
   */
  captchaToken?: string;
}

export interface EmailResult {
  success: boolean;
  provider: string;
  messageId?: string;
  timestamp: string;
  error?: string;
  /** True when a provider other than the first available one delivered it (#1321). */
  fallback?: boolean;
}

export interface EmailProvider {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  send(data: ContactFormData): Promise<EmailResult>;
  validateConfig(): Promise<boolean>;
}

export interface EmailServiceConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxFailures?: number;
}

export interface ProviderStatus {
  name: string;
  priority: number;
  available: boolean;
  failures: number;
  healthy: boolean;
  lastError?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface EmailServiceOptions {
  providers?: EmailProvider[];
  config?: EmailServiceConfig;
}

export class EmailProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}

/**
 * The provider answered, and the answer is NO: the submission itself was
 * refused (invalid, a failed challenge, rate limited), not the delivery path
 * (#1319).
 *
 * Retrying sends the same refused request again, and failing over hands it to a
 * provider that never runs the check that refused it. So EmailService does
 * neither, and the message — written by the contact function for a visitor — is
 * shown as it is.
 */
export class EmailRefusedError extends EmailProviderError {
  constructor(
    message: string,
    provider: string,
    public status: number,
    originalError?: unknown
  ) {
    super(message, provider, originalError);
    this.name = 'EmailRefusedError';
  }
}

/**
 * The provider may or may not have delivered (#1322): no response arrived, or the answer
 * cannot be read as a definite "not sent". `fetch` cannot tell "never arrived" from "arrived,
 * sent, and the response was lost".
 *
 * Failing over would deliver a second copy if the first one went out, so EmailService never
 * does. It retries only when that is safe, which means no single-use Turnstile token is
 * involved: the contact function's idempotency key turns a resend of the same text into a
 * no-op. A token, though, is spent by the first attempt, so a retry carrying it would be
 * refused as a failed challenge.
 */
export class EmailDeliveryUnknownError extends EmailProviderError {
  constructor(message: string, provider: string, originalError?: unknown) {
    super(message, provider, originalError);
    this.name = 'EmailDeliveryUnknownError';
  }
}

export class EmailServiceError extends Error {
  constructor(
    message: string,
    public failedProviders: string[]
  ) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

/**
 * Shown when delivery could not be confirmed. The contact function returns the same sentence
 * for its own in-flight case (supabase/functions/contact-message/index.ts).
 */
export const UNCONFIRMED_MESSAGE =
  "We couldn't confirm your message was sent. Press Send again: if it already arrived, it won't be sent twice.";

/**
 * The send may have happened, and the visitor needs to hear that honestly (#1322). It is
 * neither "failed, try later" nor a refusal. The form shows the message as it is.
 */
export class EmailUnconfirmedError extends EmailServiceError {
  constructor(failedProviders: string[]) {
    super(UNCONFIRMED_MESSAGE, failedProviders);
    this.name = 'EmailUnconfirmedError';
  }
}
