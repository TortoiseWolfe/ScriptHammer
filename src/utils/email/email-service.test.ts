/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailService } from './email-service';
import { Web3FormsProvider } from './providers/web3forms';
import { EmailJSProvider } from './providers/emailjs';
import type { ContactFormData, EmailResult } from './types';

// Mock providers
vi.mock('./providers/web3forms');
vi.mock('./providers/emailjs');

describe('EmailService', () => {
  let emailService: EmailService;
  let mockWeb3Forms: Web3FormsProvider;
  let mockEmailJS: EmailJSProvider;

  const testData: ContactFormData = {
    name: 'Test User',
    email: 'test@example.com',
    subject: 'Test Subject',
    message: 'Test message content',
  };

  const mockResult: EmailResult = {
    success: true,
    provider: 'Web3Forms',
    messageId: 'test-id-123',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock providers
    mockWeb3Forms = new Web3FormsProvider();
    mockEmailJS = new EmailJSProvider();

    // Set provider properties
    mockWeb3Forms.name = 'Web3Forms';
    mockWeb3Forms.priority = 1;
    mockEmailJS.name = 'EmailJS';
    mockEmailJS.priority = 2;

    // Default mock implementations
    vi.mocked(mockWeb3Forms.isAvailable).mockResolvedValue(true);
    vi.mocked(mockWeb3Forms.send).mockResolvedValue(mockResult);
    vi.mocked(mockWeb3Forms.validateConfig).mockResolvedValue(true);

    vi.mocked(mockEmailJS.isAvailable).mockResolvedValue(true);
    vi.mocked(mockEmailJS.send).mockResolvedValue({
      ...mockResult,
      provider: 'EmailJS',
    });
    vi.mocked(mockEmailJS.validateConfig).mockResolvedValue(true);

    // Create service with mocked providers and short delays for testing
    emailService = new EmailService({
      providers: [mockWeb3Forms, mockEmailJS],
      config: {
        maxRetries: 2,
        baseDelay: 10, // Short delay for tests
        maxFailures: 3,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Send Email', () => {
    it('should send email via primary provider when available', async () => {
      const result = await emailService.send(testData);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('Web3Forms');
      expect(mockWeb3Forms.send).toHaveBeenCalledWith(testData);
      expect(mockEmailJS.send).not.toHaveBeenCalled();
    });

    it('should failover to backup provider when primary fails', async () => {
      vi.mocked(mockWeb3Forms.send).mockRejectedValue(
        new Error('Web3Forms error')
      );

      const result = await emailService.send(testData);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('EmailJS');
      expect(mockWeb3Forms.send).toHaveBeenCalled();
      expect(mockEmailJS.send).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      vi.mocked(mockWeb3Forms.send).mockRejectedValue(
        new Error('Web3Forms error')
      );
      vi.mocked(mockEmailJS.send).mockRejectedValue(new Error('EmailJS error'));

      await expect(emailService.send(testData)).rejects.toThrow(
        'All email providers failed'
      );
    });

    it('should throw error when no providers are available', async () => {
      vi.mocked(mockWeb3Forms.isAvailable).mockResolvedValue(false);
      vi.mocked(mockEmailJS.isAvailable).mockResolvedValue(false);

      await expect(emailService.send(testData)).rejects.toThrow(
        'No email providers available'
      );
    });

    it('should skip provider with too many failures', async () => {
      // Simulate 3 failures for Web3Forms
      vi.mocked(mockWeb3Forms.send).mockRejectedValue(
        new Error('Web3Forms error')
      );

      // First 3 attempts should fail and increment failure count
      for (let i = 0; i < 3; i++) {
        try {
          await emailService.send(testData);
        } catch {
          // Expected to fail
        }
      }

      // Reset mocks for next attempt
      vi.clearAllMocks();
      vi.mocked(mockWeb3Forms.isAvailable).mockResolvedValue(true);
      vi.mocked(mockEmailJS.isAvailable).mockResolvedValue(true);
      vi.mocked(mockEmailJS.send).mockResolvedValue({
        ...mockResult,
        provider: 'EmailJS',
      });

      // Fourth attempt should skip Web3Forms and go straight to EmailJS
      const result = await emailService.send(testData);

      expect(result.provider).toBe('EmailJS');
      expect(mockWeb3Forms.send).not.toHaveBeenCalled();
      expect(mockEmailJS.send).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure with exponential backoff', async () => {
      let attempts = 0;
      vi.mocked(mockWeb3Forms.send).mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return mockResult;
      });

      const result = await emailService.send(testData);

      expect(result.success).toBe(true);
      expect(mockWeb3Forms.send).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying after max retries', async () => {
      vi.mocked(mockWeb3Forms.send).mockRejectedValue(
        new Error('Persistent error')
      );

      const result = await emailService.send(testData);

      // Should failover to EmailJS after retries exhausted
      expect(result.provider).toBe('EmailJS');
      expect(mockWeb3Forms.send).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Send 10 emails (the default limit)
      for (let i = 0; i < 10; i++) {
        await emailService.send(testData);
      }

      // 11th should fail due to rate limit
      await expect(emailService.send(testData)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should provide rate limit status', async () => {
      // Send 5 emails
      for (let i = 0; i < 5; i++) {
        await emailService.send(testData);
      }

      const status = emailService.getRateLimitStatus();
      expect(status.remaining).toBe(5);
      expect(status.isLimited).toBe(false);

      // Send 5 more to hit limit
      for (let i = 0; i < 5; i++) {
        await emailService.send(testData);
      }

      const limitedStatus = emailService.getRateLimitStatus();
      expect(limitedStatus.remaining).toBe(0);
      expect(limitedStatus.isLimited).toBe(true);
    });
  });

  describe('Provider Status', () => {
    it('should report provider status', async () => {
      const statuses = await emailService.getStatus();

      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toMatchObject({
        name: 'Web3Forms',
        priority: 1,
        available: true,
        failures: 0,
        healthy: true,
      });
      expect(statuses[1]).toMatchObject({
        name: 'EmailJS',
        priority: 2,
        available: true,
        failures: 0,
        healthy: true,
      });
    });

    it('should track failure counts in status', async () => {
      vi.mocked(mockWeb3Forms.send).mockRejectedValue(new Error('Test error'));

      try {
        await emailService.send(testData);
      } catch {
        // Expected to fail
      }

      const statuses = await emailService.getStatus();
      expect(statuses[0].failures).toBe(1);
      expect(statuses[0].lastError).toContain('Test error');
    });

    it('should validate all provider configurations', async () => {
      const validations = await emailService.validateAllProviders();

      expect(validations).toEqual({
        Web3Forms: true,
        EmailJS: true,
      });
    });
  });

  describe('Failure Management', () => {
    it('should reset provider failures', async () => {
      // Cause a failure
      vi.mocked(mockWeb3Forms.send).mockRejectedValue(new Error('Test error'));

      try {
        await emailService.send(testData);
      } catch {
        // Expected
      }

      let statuses = await emailService.getStatus();
      expect(statuses[0].failures).toBe(1);

      // Reset failures
      emailService.resetProviderFailures('Web3Forms');

      statuses = await emailService.getStatus();
      expect(statuses[0].failures).toBe(0);
    });

    it('should reset all failures', async () => {
      // Cause failures for both providers
      vi.mocked(mockWeb3Forms.send).mockRejectedValue(
        new Error('Web3Forms error')
      );
      vi.mocked(mockEmailJS.send).mockRejectedValue(new Error('EmailJS error'));

      try {
        await emailService.send(testData);
      } catch {
        // Expected
      }

      let statuses = await emailService.getStatus();
      expect(statuses[0].failures).toBe(1);
      expect(statuses[1].failures).toBe(1);

      // Reset all
      emailService.resetAllFailures();

      statuses = await emailService.getStatus();
      expect(statuses[0].failures).toBe(0);
      expect(statuses[1].failures).toBe(0);
    });
  });

  describe('Provider Priority', () => {
    it('should respect provider priority order', async () => {
      // Create service with reversed priority
      const reversedService = new EmailService({
        providers: [mockEmailJS, mockWeb3Forms],
      });

      // EmailJS has priority 2, Web3Forms has priority 1
      // Should still use Web3Forms first due to priority value
      const result = await reversedService.send(testData);

      expect(result.provider).toBe('Web3Forms');
      expect(mockWeb3Forms.send).toHaveBeenCalled();
      expect(mockEmailJS.send).not.toHaveBeenCalled();
    });
  });
});
