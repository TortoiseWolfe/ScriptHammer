import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeb3Forms } from './useWeb3Forms';
import * as web3formsUtils from '@/utils/web3forms';
import { emailService } from '@/utils/email/email-service';
import type { ContactFormData } from '@/schemas/contact.schema';

// Mock the utilities
vi.mock('@/utils/web3forms', () => ({
  formatErrorMessage: vi.fn(),
}));

// Mock email service
vi.mock('@/utils/email/email-service', () => ({
  emailService: {
    send: vi.fn(),
    getStatus: vi.fn(),
    getRateLimitStatus: vi.fn(),
  },
}));

// Mock offline queue utilities
vi.mock('@/utils/offline-queue', () => ({
  addToQueue: vi.fn().mockResolvedValue(true),
  getQueueSize: vi.fn().mockResolvedValue(0),
  getQueuedItems: vi.fn().mockResolvedValue([]),
  removeFromQueue: vi.fn().mockResolvedValue(true),
  clearQueue: vi.fn().mockResolvedValue(true),
  openDatabase: vi.fn(),
  updateRetryCount: vi.fn().mockResolvedValue(true),
}));

// Mock background sync utilities
vi.mock('@/utils/background-sync', () => ({
  registerBackgroundSync: vi.fn().mockResolvedValue(true),
  processQueue: vi.fn().mockResolvedValue(undefined),
  getSyncStatus: vi.fn().mockResolvedValue({
    supported: false,
    registered: false,
  }),
}));

// Mock the offline queue hook
vi.mock('./useOfflineQueue', () => ({
  useOfflineQueue: vi.fn(() => ({
    isOnline: true,
  })),
}));

describe('useWeb3Forms Hook', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  const validFormData: ContactFormData = {
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Test Subject',
    message: 'This is a test message',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(web3formsUtils.formatErrorMessage).mockImplementation(
      (error) => error.message
    );
    // Mock successful email send by default
    vi.mocked(emailService.send).mockResolvedValue({
      success: true,
      provider: 'Web3Forms',
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useWeb3Forms());

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.successMessage).toBeNull();
      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasQueuedOffline).toBe(false);
    });

    it('should accept custom callbacks', () => {
      const { result } = renderHook(() =>
        useWeb3Forms({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
        })
      );

      expect(result.current.submitForm).toBeDefined();
      expect(typeof result.current.submitForm).toBe('function');
    });
  });

  describe('Form Submission', () => {
    it('should handle successful submission', async () => {
      const { result } = renderHook(() =>
        useWeb3Forms({
          onSuccess: mockOnSuccess,
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.successMessage).toBe('Email sent successfully');
      expect(mockOnSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Email sent via Web3Forms',
        })
      );
      expect(emailService.send).toHaveBeenCalled();
    });

    it('should handle submission errors', async () => {
      const error = new Error('Network error');
      vi.mocked(emailService.send).mockRejectedValue(error);
      vi.mocked(web3formsUtils.formatErrorMessage).mockReturnValue(
        'Network error. Please try again.'
      );

      const { result } = renderHook(() =>
        useWeb3Forms({
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe('Network error. Please try again.');
      expect(mockOnError).toHaveBeenCalledWith(error);
    });

    it('should show submitting state during submission', async () => {
      let resolveSubmit: (value: unknown) => void;
      const submissionPromise = new Promise((resolve) => {
        resolveSubmit = resolve;
      });

      vi.mocked(emailService.send).mockReturnValue(
        submissionPromise.then(() => ({
          success: true,
          provider: 'Web3Forms',
          messageId: 'test-id',
          timestamp: new Date().toISOString(),
        }))
      );

      const { result } = renderHook(() => useWeb3Forms());

      act(() => {
        result.current.submitForm(validFormData);
      });

      // Check submitting state
      expect(result.current.isSubmitting).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Resolve the promise
      await act(async () => {
        resolveSubmit!({ success: true, message: 'Sent' });
        await waitFor(() => !result.current.isSubmitting);
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should prevent submission when rate limited', async () => {
      const rateLimitError = new Error(
        'Rate limit exceeded. Please wait before sending another message.'
      );
      vi.mocked(emailService.send).mockRejectedValue(rateLimitError);
      vi.mocked(web3formsUtils.formatErrorMessage).mockReturnValue(
        'Rate limit exceeded. Please wait before sending another message.'
      );

      const { result } = renderHook(() =>
        useWeb3Forms({
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(emailService.send).toHaveBeenCalled();
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toContain('Rate limit exceeded');
      expect(mockOnError).toHaveBeenCalled();
    });

    it('should record successful submissions for rate limiting', async () => {
      const { result } = renderHook(() => useWeb3Forms());

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      // Rate limiting is now handled internally by emailService
      expect(emailService.send).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('State Reset', () => {
    it('should provide reset function', async () => {
      const { result } = renderHook(() => useWeb3Forms());

      // Submit form
      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.successMessage).toBeTruthy();

      // Reset state
      act(() => {
        result.current.reset();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.successMessage).toBeNull();
    });
  });

  describe('Custom Messages', () => {
    it('should use custom success message if provided', async () => {
      const customMessage = 'Your message has been sent!';

      const { result } = renderHook(() =>
        useWeb3Forms({
          successMessage: customMessage,
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(result.current.successMessage).toBe(customMessage);
    });

    it('should use custom error message if provided', async () => {
      const customError = 'Oops! Something went wrong.';
      vi.mocked(emailService.send).mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() =>
        useWeb3Forms({
          errorMessage: customError,
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(result.current.error).toBe(customError);
    });
  });

  describe('Offline Support', () => {
    beforeEach(() => {
      // Mock offline queue hook for offline tests
      vi.resetModules();
    });

    it('should queue submission when offline', async () => {
      const { useOfflineQueue } = await import('./useOfflineQueue');

      vi.mocked(useOfflineQueue).mockReturnValue({
        queue: [],
        queueCount: 0,
        failedCount: 0,
        isSyncing: false,
        isOnline: false,
        syncQueue: vi.fn(),
        retryFailed: vi.fn(),
        clearSynced: vi.fn(),
        getFailedMessages: vi.fn().mockResolvedValue([]),
      });

      const { result } = renderHook(() => useWeb3Forms());

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(emailService.send).not.toHaveBeenCalled();
      // localStorage is used directly in the hook, not a mockable external function
      expect(result.current.wasQueuedOffline).toBe(true);
      expect(result.current.successMessage).toContain('queued for sending');
    });
  });

  describe('Validation Integration', () => {
    it('should validate form data before submission', async () => {
      const { result } = renderHook(() => useWeb3Forms());

      const isValid = await result.current.validateBeforeSubmit(validFormData);

      expect(isValid).toBe(true);
    });

    it('should reject invalid form data', async () => {
      const { result } = renderHook(() =>
        useWeb3Forms({
          onError: mockOnError,
        })
      );

      const invalidData = {
        ...validFormData,
        email: 'invalid-email',
      };

      let isValid = true;
      await act(async () => {
        isValid = await result.current.validateBeforeSubmit(invalidData);
      });

      expect(isValid).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(mockOnError).toHaveBeenCalled();
    });

    it('should submit valid data after validation', async () => {
      // Ensure online state
      const { useOfflineQueue } = await import('./useOfflineQueue');
      vi.mocked(useOfflineQueue).mockReturnValue({
        queue: [],
        queueCount: 0,
        failedCount: 0,
        isSyncing: false,
        isOnline: true,
        syncQueue: vi.fn(),
        retryFailed: vi.fn(),
        clearSynced: vi.fn(),
        getFailedMessages: vi.fn().mockResolvedValue([]),
      });

      const { result } = renderHook(() => useWeb3Forms());

      // Validate first
      let isValid = false;
      await act(async () => {
        isValid = await result.current.validateBeforeSubmit(validFormData);
      });
      expect(isValid).toBe(true);

      // Then submit
      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(emailService.send).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('Auto Timeout', () => {
    it('should auto-reset success state after timeout', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useWeb3Forms({
          autoResetDelay: 1000,
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(result.current.isSuccess).toBe(true);

      // Fast-forward time and wait for state update
      await act(async () => {
        vi.advanceTimersByTime(1001);
      });

      expect(result.current.isSuccess).toBe(false);
      expect(result.current.successMessage).toBeNull();

      vi.useRealTimers();
    });

    it('should not auto-reset if disabled', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useWeb3Forms({
          autoResetDelay: 0, // Disabled
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      expect(result.current.isSuccess).toBe(true);

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(10000); // Way past any timeout
      });

      // Should still be success
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.successMessage).toBeTruthy();

      vi.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    it('should clean up timeouts on unmount', async () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { result, unmount } = renderHook(() =>
        useWeb3Forms({
          autoResetDelay: 5000,
        })
      );

      await act(async () => {
        await result.current.submitForm(validFormData);
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
