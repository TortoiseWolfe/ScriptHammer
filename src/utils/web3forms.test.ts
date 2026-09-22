import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  submitToWeb3Forms,
  isRetryableError,
  calculateBackoffDelay,
  submitWithRetry,
  checkRateLimit,
  recordSubmission,
  clearRateLimitHistory,
  sanitizeFormData,
  validateWeb3FormsResponse,
  formatErrorMessage,
  WEB3FORMS_CONFIG,
  RETRY_CONFIG,
  RATE_LIMIT_CONFIG,
} from './web3forms';
import type { ContactFormData } from '@/schemas/contact.schema';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variable
process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY = 'test-access-key';

// Mock localStorage
const localStorageMock: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageMock).forEach(
      (key) => delete localStorageMock[key]
    );
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Web3Forms Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    // Reset Date.now mock
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('submitToWeb3Forms', () => {
    const validFormData: ContactFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Test Subject',
      message: 'This is a test message',
    };

    it('should successfully submit form data', async () => {
      const mockResponse = {
        success: true,
        message: 'Email sent successfully',
        data: {
          id: 'test-id',
          email: 'john@example.com',
          from_name: 'John Doe',
          subject: 'Test Subject',
          message: 'This is a test message',
          date: '2025-01-15T12:00:00Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await submitToWeb3Forms(validFormData);

      expect(mockFetch).toHaveBeenCalledWith(WEB3FORMS_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_CONFIG.accessKey,
          ...validFormData,
          from_name: 'ScriptHammer Contact Form',
          botcheck: false,
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(submitToWeb3Forms(validFormData)).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle non-ok responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(submitToWeb3Forms(validFormData)).rejects.toThrow(
        'HTTP error! status: 500'
      );
    });

    it('should handle API error responses', async () => {
      const errorResponse = {
        success: false,
        message: 'Invalid access key',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => errorResponse,
      });

      await expect(submitToWeb3Forms(validFormData)).rejects.toThrow(
        'Invalid access key'
      );
    });

    it('should sanitize form data before submission', async () => {
      const unsafeData: ContactFormData = {
        name: '<script>alert("XSS")</script>John',
        email: 'john@example.com',
        subject: 'Test<img src=x onerror=alert(1)>',
        message: 'Message with javascript:alert(1)',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Sent' }),
      });

      await submitToWeb3Forms(unsafeData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.name).not.toContain('<script>');
      expect(callBody.subject).not.toContain('<img');
      expect(callBody.message).not.toContain('javascript:');
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = new Error('Network error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = new Error('Request timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify 5xx errors as retryable', () => {
      const error = new Error('HTTP error! status: 503');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify 429 errors as retryable', () => {
      const error = new Error('HTTP error! status: 429');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not identify 4xx errors as retryable (except 429)', () => {
      const error = new Error('HTTP error! status: 400');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should not identify validation errors as retryable', () => {
      const error = new Error('Validation failed');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(calculateBackoffDelay(0)).toBe(RETRY_CONFIG.baseDelay);
      expect(calculateBackoffDelay(1)).toBe(
        RETRY_CONFIG.baseDelay * RETRY_CONFIG.backoffFactor
      );
      expect(calculateBackoffDelay(2)).toBe(
        RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, 2)
      );
    });

    it('should respect maximum delay', () => {
      const largeRetryCount = 10;
      expect(calculateBackoffDelay(largeRetryCount)).toBe(
        RETRY_CONFIG.maxDelay
      );
    });

    it('should add jitter to prevent thundering herd', () => {
      const delay1 = calculateBackoffDelay(1, true);
      // With jitter, consecutive calls should likely produce different results
      // We'll check that it's within expected range
      const expectedBase = RETRY_CONFIG.baseDelay * RETRY_CONFIG.backoffFactor;
      expect(delay1).toBeGreaterThanOrEqual(expectedBase * 0.5);
      expect(delay1).toBeLessThanOrEqual(expectedBase * 1.5);
    });
  });

  describe('submitWithRetry', () => {
    const validFormData: ContactFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Test Subject',
      message: 'This is a test message',
    };

    it('should succeed on first try', async () => {
      const mockResponse = { success: true, message: 'Sent' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await submitWithRetry(validFormData);
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const mockResponse = { success: true, message: 'Sent' };

      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const promise = submitWithRetry(validFormData);

      // Advance timers to handle the retry delay
      await vi.advanceTimersByTimeAsync(RETRY_CONFIG.baseDelay);

      const result = await promise;
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const promise = submitWithRetry(validFormData).catch((e) => e);

      // Advance through all retry delays
      for (let i = 0; i < RETRY_CONFIG.maxRetries; i++) {
        await vi.advanceTimersByTimeAsync(calculateBackoffDelay(i));
      }

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(RETRY_CONFIG.maxRetries + 1);
    });

    it('should not retry non-retryable errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Validation failed'));

      await expect(submitWithRetry(validFormData)).rejects.toThrow(
        'Validation failed'
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should apply backoff delays between retries', async () => {
      const mockResponse = { success: true, message: 'Sent' };

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const promise = submitWithRetry(validFormData);

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(calculateBackoffDelay(0));
      await vi.advanceTimersByTimeAsync(calculateBackoffDelay(1));

      const result = await promise;
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Rate Limiting', () => {
    describe('checkRateLimit', () => {
      it('should allow submissions when under limit', () => {
        expect(checkRateLimit()).toBe(true);
      });

      it('should block submissions when limit exceeded', () => {
        const now = Date.now();
        const submissions = Array(RATE_LIMIT_CONFIG.maxSubmissions)
          .fill(0)
          .map((_, i) => now - i * 1000);

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions,
          blockedUntil: null,
        });

        expect(checkRateLimit()).toBe(false);
      });

      it('should only count recent submissions within time window', () => {
        const now = Date.now();
        const oldSubmission = now - RATE_LIMIT_CONFIG.timeWindow - 1000;
        const recentSubmissions = Array(RATE_LIMIT_CONFIG.maxSubmissions - 1)
          .fill(0)
          .map((_, i) => now - i * 1000);

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [oldSubmission, ...recentSubmissions],
          blockedUntil: null,
        });

        expect(checkRateLimit()).toBe(true);
      });

      it('should respect block duration after limit exceeded', () => {
        const now = Date.now();
        const blockedUntil = now + 60000; // Blocked for 1 more minute

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [],
          blockedUntil,
        });

        expect(checkRateLimit()).toBe(false);
      });

      it('should allow submissions after block duration expires', () => {
        const now = Date.now();
        const blockedUntil = now - 1000; // Block expired 1 second ago

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [],
          blockedUntil,
        });

        expect(checkRateLimit()).toBe(true);
      });
    });

    describe('recordSubmission', () => {
      it('should record new submission', () => {
        recordSubmission();

        const data = JSON.parse(localStorageMock[RATE_LIMIT_CONFIG.storageKey]);
        expect(data.submissions).toHaveLength(1);
        expect(data.submissions[0]).toBe(Date.now());
      });

      it('should append to existing submissions', () => {
        const existingSubmission = Date.now() - 5000;
        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [existingSubmission],
          blockedUntil: null,
        });

        recordSubmission();

        const data = JSON.parse(localStorageMock[RATE_LIMIT_CONFIG.storageKey]);
        expect(data.submissions).toHaveLength(2);
      });

      it('should set block time when limit exceeded', () => {
        const submissions = Array(RATE_LIMIT_CONFIG.maxSubmissions - 1)
          .fill(0)
          .map((_, i) => Date.now() - i * 1000);

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions,
          blockedUntil: null,
        });

        recordSubmission();

        const data = JSON.parse(localStorageMock[RATE_LIMIT_CONFIG.storageKey]);
        expect(data.blockedUntil).toBeGreaterThan(Date.now());
        expect(data.blockedUntil).toBe(
          Date.now() + RATE_LIMIT_CONFIG.blockDuration
        );
      });
    });

    describe('clearRateLimitHistory', () => {
      it('should clear rate limit data', () => {
        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [Date.now()],
          blockedUntil: Date.now() + 60000,
        });

        clearRateLimitHistory();

        expect(localStorageMock[RATE_LIMIT_CONFIG.storageKey]).toBeUndefined();
      });
    });
  });

  describe('sanitizeFormData', () => {
    it('should remove script tags', () => {
      const input: ContactFormData = {
        name: '<script>alert("XSS")</script>John',
        email: 'john@example.com',
        subject: 'Test',
        message: 'Hello <script>evil()</script> world',
      };

      const result = sanitizeFormData(input);
      expect(result.name).toBe('John');
      expect(result.message).toBe('Hello  world');
    });

    it('should remove event handlers', () => {
      const input: ContactFormData = {
        name: 'John',
        email: 'john@example.com',
        subject: 'Test <span onclick="alert(1)">click</span>',
        message: 'Test message',
      };

      const result = sanitizeFormData(input);
      expect(result.subject).not.toContain('onclick');
    });

    it('should remove javascript: URLs', () => {
      const input: ContactFormData = {
        name: 'John',
        email: 'john@example.com',
        subject: 'Test',
        message: 'Click <a href="javascript:void(0)">here</a>',
      };

      const result = sanitizeFormData(input);
      expect(result.message).not.toContain('javascript:');
    });

    it('should preserve safe content', () => {
      const input: ContactFormData = {
        name: "John O'Connor Jr.",
        email: 'john@example.com',
        subject: 'Question about pricing & features',
        message: 'I have a question: Is this < $100?',
      };

      const result = sanitizeFormData(input);
      expect(result.name).toBe("John O'Connor Jr.");
      expect(result.subject).toBe('Question about pricing & features');
      expect(result.message).toContain('< $100');
    });
  });

  describe('validateWeb3FormsResponse', () => {
    it('should validate successful response', () => {
      const response = {
        success: true,
        message: 'Email sent',
        data: {
          id: '123',
          email: 'test@example.com',
        },
      };

      expect(() => validateWeb3FormsResponse(response)).not.toThrow();
    });

    it('should validate error response', () => {
      const response = {
        success: false,
        message: 'Invalid access key',
      };

      expect(() => validateWeb3FormsResponse(response)).not.toThrow();
    });

    it('should throw on invalid response structure', () => {
      const invalidResponse = {
        // Missing required fields
        data: {},
      };

      expect(() => validateWeb3FormsResponse(invalidResponse)).toThrow();
    });

    it('should throw on non-object response', () => {
      expect(() => validateWeb3FormsResponse(null)).toThrow();
      expect(() => validateWeb3FormsResponse(undefined)).toThrow();
      expect(() => validateWeb3FormsResponse('string')).toThrow();
    });
  });
});

/**
 * `formatErrorMessage` owns every failure sentence a visitor reads on the contact
 * form, and had ZERO coverage until #1205 — the one function whose output IS the
 * user experience of a broken form was the one nothing asserted.
 *
 * Every branch is exercised, including both arms of the rate-limit guard and the
 * default. Deleting any single guard must turn exactly one case red; a suite that
 * stays green through that mutation is not covering the branch, it is covering the
 * default underneath it.
 */
describe('formatErrorMessage', () => {
  it('names a network failure', () => {
    expect(formatErrorMessage(new Error('Network request failed'))).toBe(
      'Network error. Please check your connection and try again.'
    );
  });

  it('names a timeout', () => {
    expect(formatErrorMessage(new Error('Request timeout'))).toBe(
      'Request timed out. Please try again.'
    );
  });

  // BOTH arms. The guard is `includes('rate limit') || includes('429')`, so asserting
  // one arm leaves the other deletable with the suite still green.
  it('names a rate limit, by phrase', () => {
    expect(formatErrorMessage(new Error('Rate limit exceeded'))).toBe(
      'Too many requests. Please wait a moment and try again.'
    );
  });

  it('names a rate limit, by status code', () => {
    expect(formatErrorMessage(new Error('Request failed with 429'))).toBe(
      'Too many requests. Please wait a moment and try again.'
    );
  });

  it('names a validation problem', () => {
    expect(formatErrorMessage(new Error('validation failed'))).toBe(
      'Please check your input and try again.'
    );
  });

  it('names a queueing failure', () => {
    expect(formatErrorMessage(new Error('Failed to queue message'))).toBe(
      'Failed to queue message. Please try again.'
    );
  });

  it('falls back to the generic message for an unrecognised error', () => {
    // `toBe`, not `toContain`: a substring assertion on the default would survive a
    // reword, and the default is the string this whole ticket is about.
    expect(formatErrorMessage(new Error('something unmapped'))).toBe(
      'An error occurred. Please try again later.'
    );
  });

  it('is case-insensitive, because provider errors are not normalised', () => {
    expect(formatErrorMessage(new Error('NETWORK UNREACHABLE'))).toBe(
      'Network error. Please check your connection and try again.'
    );
  });

  /**
   * #1204: a MISCONFIGURED form must not be told to try again later.
   *
   * "Please try again later" is a lie that never becomes true when nothing is
   * configured — the visitor retries forever and the owner never hears about it.
   * These are the exact strings `EmailService` throws, so they are the messages that
   * actually reach here in production.
   */
  describe('a configuration failure is distinguishable from a transient one (#1204)', () => {
    it('recognises "no providers available"', () => {
      const out = formatErrorMessage(
        new Error('No email providers available. Please check configuration.')
      );
      expect(out).toBe('Configuration error. Please contact support.');
      expect(out).not.toContain('try again later');
    });

    it('recognises a provider reporting it is not configured', () => {
      const out = formatErrorMessage(
        new Error(
          'All email providers failed: Contact delivery is not configured'
        )
      );
      expect(out).toBe('Configuration error. Please contact support.');
      expect(out).not.toContain('try again later');
    });

    it('still recognises the original Web3Forms access-key wording', () => {
      expect(formatErrorMessage(new Error('Invalid access key provided'))).toBe(
        'Configuration error. Please contact support.'
      );
    });

    it('leaves a genuinely transient provider failure on the generic message', () => {
      // The counterpart that stops the fix over-reaching: an aggregate failure with no
      // configuration signal really is "try again later", and must stay that way.
      expect(
        formatErrorMessage(
          new Error('All email providers failed: Web3Forms error 503')
        )
      ).toBe('An error occurred. Please try again later.');
    });
  });
});
