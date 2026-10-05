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

export class EmailServiceError extends Error {
  constructor(
    message: string,
    public failedProviders: string[]
  ) {
    super(message);
    this.name = 'EmailServiceError';
  }
}
