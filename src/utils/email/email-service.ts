import { Web3FormsProvider } from './providers/web3forms';
import { EmailJSProvider } from './providers/emailjs';
import {
  ContactFormData,
  EmailProvider,
  EmailResult,
  EmailServiceConfig,
  EmailServiceError,
  EmailServiceOptions,
  ProviderStatus,
  RateLimitConfig,
} from './types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:email-service');

const DEFAULT_CONFIG: EmailServiceConfig = {
  maxRetries: 2,
  baseDelay: 1000,
  maxFailures: 3,
};

const RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
};

export class EmailService {
  private providers: EmailProvider[] = [];
  private failureLog: Map<string, number> = new Map();
  private lastErrorLog: Map<string, string> = new Map();
  private config: EmailServiceConfig;
  private submissionTimestamps: number[] = [];

  constructor(options: EmailServiceOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };

    // Register providers in priority order
    this.providers = options.providers || [
      new Web3FormsProvider(),
      new EmailJSProvider(),
    ];
  }

  /**
   * Send email through available providers with failover
   */
  async send(data: ContactFormData): Promise<EmailResult> {
    // Check rate limit
    if (!this.checkRateLimit()) {
      throw new EmailServiceError(
        'Rate limit exceeded. Please wait before sending another message.',
        []
      );
    }

    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new EmailServiceError(
        'No email providers available. Please check configuration.',
        this.providers.map((p) => p.name)
      );
    }

    const failedProviders: string[] = [];

    // Try each provider in order
    for (const provider of availableProviders) {
      try {
        logger.info('Attempting to send via provider', {
          provider: provider.name,
        });

        const result = await this.sendWithRetry(provider, data);

        // Reset failure count on success
        this.failureLog.delete(provider.name);
        this.lastErrorLog.delete(provider.name);

        // Record submission for rate limiting
        this.recordSubmission();

        logger.info('Successfully sent via provider', {
          provider: provider.name,
        });
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        logger.error('Provider failed', {
          provider: provider.name,
          error: errorMessage,
        });

        // Track failures
        const failures = (this.failureLog.get(provider.name) || 0) + 1;
        this.failureLog.set(provider.name, failures);
        this.lastErrorLog.set(provider.name, errorMessage);

        failedProviders.push(provider.name);

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    throw new EmailServiceError(
      'All email providers failed. Please try again later.',
      failedProviders
    );
  }

  /**
   * Send with retry logic
   */
  private async sendWithRetry(
    provider: EmailProvider,
    data: ContactFormData,
    retries = this.config.maxRetries || 2,
    delay = this.config.baseDelay || 1000
  ): Promise<EmailResult> {
    try {
      return await provider.send(data);
    } catch (error) {
      if (retries <= 0) {
        throw error;
      }

      logger.info('Retrying provider', {
        provider: provider.name,
        delayMs: delay,
        retriesLeft: retries,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.sendWithRetry(
        provider,
        data,
        retries - 1,
        delay * 2 // Exponential backoff
      );
    }
  }

  /**
   * Get available providers based on configuration and health
   */
  private async getAvailableProviders(): Promise<EmailProvider[]> {
    const available: EmailProvider[] = [];

    for (const provider of this.providers) {
      const isAvailable = await provider.isAvailable();
      const recentFailures = this.failureLog.get(provider.name) || 0;

      // Skip providers with too many recent failures
      if (isAvailable && recentFailures < (this.config.maxFailures || 3)) {
        available.push(provider);
      }
    }

    return available.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

    // Remove old timestamps outside the window
    this.submissionTimestamps = this.submissionTimestamps.filter(
      (timestamp) => timestamp > windowStart
    );

    // Check if under limit
    return this.submissionTimestamps.length < RATE_LIMIT_CONFIG.maxRequests;
  }

  /**
   * Record a submission for rate limiting
   */
  private recordSubmission(): void {
    this.submissionTimestamps.push(Date.now());
  }

  /**
   * Get status of all providers
   */
  async getStatus(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];

    for (const provider of this.providers) {
      const available = await provider.isAvailable();
      const failures = this.failureLog.get(provider.name) || 0;
      const lastError = this.lastErrorLog.get(provider.name);

      statuses.push({
        name: provider.name,
        priority: provider.priority,
        available,
        failures,
        healthy: available && failures < (this.config.maxFailures || 3),
        lastError,
      });
    }

    return statuses;
  }

  /**
   * Validate all provider configurations
   */
  async validateAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const provider of this.providers) {
      try {
        results[provider.name] = await provider.validateConfig();
      } catch {
        results[provider.name] = false;
      }
    }

    return results;
  }

  /**
   * Reset failure tracking for a provider
   */
  resetProviderFailures(providerName: string): void {
    this.failureLog.delete(providerName);
    this.lastErrorLog.delete(providerName);
  }

  /**
   * Reset all failure tracking
   */
  resetAllFailures(): void {
    this.failureLog.clear();
    this.lastErrorLog.clear();
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): {
    remaining: number;
    resetTime: number;
    isLimited: boolean;
  } {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

    // Remove old timestamps outside the window
    this.submissionTimestamps = this.submissionTimestamps.filter(
      (timestamp) => timestamp > windowStart
    );

    const remaining = Math.max(
      0,
      RATE_LIMIT_CONFIG.maxRequests - this.submissionTimestamps.length
    );

    // Find when the oldest timestamp will expire
    const resetTime =
      this.submissionTimestamps.length > 0
        ? this.submissionTimestamps[0] + RATE_LIMIT_CONFIG.windowMs
        : now;

    return {
      remaining,
      resetTime,
      isLimited: remaining === 0,
    };
  }
}

// Singleton instance for convenience
export const emailService = new EmailService();
