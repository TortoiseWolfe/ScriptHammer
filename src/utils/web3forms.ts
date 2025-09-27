import type {
  ContactFormData,
  Web3FormsResponse,
} from '@/schemas/contact.schema';

// Re-export the Web3FormsResponse type for external use
export type { Web3FormsResponse };

/**
 * Web3Forms configuration
 */
export const WEB3FORMS_CONFIG = {
  endpoint: 'https://api.web3forms.com/submit',
  get accessKey() {
    return process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || '';
  },
  fromName: 'ScriptHammer Contact Form',
} as const;

/**
 * Retry configuration for failed submissions
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  maxSubmissions: 5,
  timeWindow: 300000, // 5 minutes
  blockDuration: 900000, // 15 minutes
  storageKey: 'contact-form-rate-limit',
} as const;

/**
 * Rate limit data structure
 */
interface RateLimitData {
  submissions: number[];
  blockedUntil: number | null;
}

/**
 * Sanitize form data to prevent XSS and injection attacks
 */
export const sanitizeFormData = (data: ContactFormData): ContactFormData => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  };

  return {
    ...data,
    name: sanitizeString(data.name),
    subject: sanitizeString(data.subject),
    message: sanitizeString(data.message),
    // Email is already validated by schema, just return as-is
    email: data.email,
  };
};

/**
 * Validate Web3Forms API response structure
 */
export const validateWeb3FormsResponse = (response: unknown): void => {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response structure');
  }

  const res = response as Record<string, unknown>;

  if (typeof res.success !== 'boolean') {
    throw new Error('Response missing required "success" field');
  }

  if (typeof res.message !== 'string') {
    throw new Error('Response missing required "message" field');
  }
};

/**
 * Submit form data to Web3Forms API
 */
export const submitToWeb3Forms = async (
  formData: ContactFormData
): Promise<Web3FormsResponse> => {
  if (!WEB3FORMS_CONFIG.accessKey) {
    throw new Error('Web3Forms access key is not configured');
  }

  // Sanitize form data before submission
  const sanitizedData = sanitizeFormData(formData);

  const payload = {
    access_key: WEB3FORMS_CONFIG.accessKey,
    ...sanitizedData,
    from_name: WEB3FORMS_CONFIG.fromName,
    botcheck: false,
  };

  try {
    const response = await fetch(WEB3FORMS_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate response structure
    validateWeb3FormsResponse(data);

    // Check for API-level errors
    if (!data.success) {
      throw new Error(data.message || 'Form submission failed');
    }

    return data as Web3FormsResponse;
  } catch (error) {
    // Re-throw with more context if needed
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred during form submission');
  }
};

/**
 * Check if an error is retryable
 */
export const isRetryableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return true;
  }

  // Timeout errors
  if (message.includes('timeout')) {
    return true;
  }

  // HTTP status codes
  if (message.includes('http error')) {
    const statusMatch = message.match(/status:\s*(\d+)/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      // Retry on 5xx errors and 429 (rate limit)
      return status >= 500 || status === 429;
    }
  }

  return false;
};

/**
 * Calculate backoff delay for retries
 */
export const calculateBackoffDelay = (
  retryCount: number,
  addJitter = false
): number => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, retryCount),
    RETRY_CONFIG.maxDelay
  );

  if (addJitter) {
    // Add ±50% jitter to prevent thundering herd
    const jitter = delay * 0.5 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  return delay;
};

/**
 * Submit form with retry logic
 */
export const submitWithRetry = async (
  formData: ContactFormData,
  retryCount = 0
): Promise<Web3FormsResponse> => {
  try {
    return await submitToWeb3Forms(formData);
  } catch (error) {
    if (
      error instanceof Error &&
      retryCount < RETRY_CONFIG.maxRetries &&
      isRetryableError(error)
    ) {
      const delay = calculateBackoffDelay(retryCount);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry with incremented count
      return submitWithRetry(formData, retryCount + 1);
    }

    // Max retries reached or non-retryable error
    throw error;
  }
};

/**
 * Check if rate limit allows submission
 */
export const checkRateLimit = (): boolean => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_CONFIG.storageKey);
    if (!stored) {
      return true; // No history, allow submission
    }

    const data: RateLimitData = JSON.parse(stored);
    const now = Date.now();

    // Check if currently blocked
    if (data.blockedUntil && data.blockedUntil > now) {
      return false;
    }

    // Filter recent submissions within time window
    const recentSubmissions = data.submissions.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.timeWindow
    );

    // Check if under limit
    return recentSubmissions.length < RATE_LIMIT_CONFIG.maxSubmissions;
  } catch {
    // If localStorage is unavailable or data is corrupted, allow submission
    return true;
  }
};

/**
 * Record a new submission for rate limiting
 */
export const recordSubmission = (): void => {
  try {
    const now = Date.now();
    const stored = localStorage.getItem(RATE_LIMIT_CONFIG.storageKey);

    let data: RateLimitData = {
      submissions: [],
      blockedUntil: null,
    };

    if (stored) {
      try {
        data = JSON.parse(stored);
      } catch {
        // Reset if data is corrupted
      }
    }

    // Add new submission
    data.submissions.push(now);

    // Keep only recent submissions
    data.submissions = data.submissions.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.timeWindow
    );

    // Check if limit exceeded
    if (data.submissions.length >= RATE_LIMIT_CONFIG.maxSubmissions) {
      data.blockedUntil = now + RATE_LIMIT_CONFIG.blockDuration;
    }

    localStorage.setItem(RATE_LIMIT_CONFIG.storageKey, JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

/**
 * Clear rate limit history (for testing or admin use)
 */
export const clearRateLimitHistory = (): void => {
  try {
    localStorage.removeItem(RATE_LIMIT_CONFIG.storageKey);
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

/**
 * Format error message for user display
 */
export const formatErrorMessage = (error: Error): string => {
  const message = error.message.toLowerCase();

  if (message.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  if (message.includes('rate limit') || message.includes('429')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (message.includes('access key')) {
    return 'Configuration error. Please contact support.';
  }

  if (message.includes('validation')) {
    return 'Please check your input and try again.';
  }

  if (message.includes('failed to queue message')) {
    return 'Failed to queue message. Please try again.';
  }

  // Default message
  return 'An error occurred. Please try again later.';
};
