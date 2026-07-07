export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
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

export class EmailServiceError extends Error {
  constructor(
    message: string,
    public failedProviders: string[]
  ) {
    super(message);
    this.name = 'EmailServiceError';
  }
}
