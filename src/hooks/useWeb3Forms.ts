'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import { formatErrorMessage } from '@/utils/web3forms';
import { emailService } from '@/utils/email/email-service';
import type { ContactFormData as EmailContactFormData } from '@/utils/email/types';
import {
  contactSchema,
  type ContactFormData,
  type Web3FormsResponse,
} from '@/schemas/contact.schema';
import { useOfflineQueue } from './useOfflineQueue';
import { addToQueue, getQueueSize } from '@/utils/offline-queue';
import { registerBackgroundSync } from '@/utils/background-sync';

const logger = createLogger('hooks:web3Forms');

/**
 * Hook configuration options
 */
export interface UseWeb3FormsOptions {
  onSuccess?: (response: Web3FormsResponse) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  autoResetDelay?: number; // milliseconds, 0 to disable
}

/**
 * Hook return type
 */
export interface UseWeb3FormsReturn {
  submitForm: (data: ContactFormData) => Promise<void>;
  validateBeforeSubmit: (data: ContactFormData) => Promise<boolean>;
  reset: () => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  successMessage: string | null;
  isOnline: boolean;
  queueCount: number;
  wasQueuedOffline: boolean;
}

/**
 * Custom hook for handling Web3Forms submissions
 */
export const useWeb3Forms = (
  options: UseWeb3FormsOptions = {}
): UseWeb3FormsReturn => {
  const {
    onSuccess,
    onError,
    successMessage: customSuccessMessage,
    errorMessage: customErrorMessage,
    autoResetDelay = 5000,
  } = options;

  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [wasQueuedOffline, setWasQueuedOffline] = useState(false);

  // Use offline queue hook for network status
  const { isOnline, queueCount: messagingQueueCount } = useOfflineQueue();

  // Forms-specific offline queue using IndexedDB
  const [formsQueueCount, setFormsQueueCount] = useState(0);

  // Load initial queue size
  useEffect(() => {
    const loadQueueSize = async () => {
      const size = await getQueueSize();
      setFormsQueueCount(size);
    };
    loadQueueSize();
  }, []);

  const queueCount = formsQueueCount + messagingQueueCount;

  const addToOfflineQueue = useCallback(
    async (data: ContactFormData): Promise<{ id: string; queued: boolean }> => {
      try {
        const success = await addToQueue(data);
        if (success) {
          const newSize = await getQueueSize();
          setFormsQueueCount(newSize);

          // Register background sync to process when online
          await registerBackgroundSync();

          return { id: `form-${Date.now()}`, queued: true };
        }
        return { id: '', queued: false };
      } catch (error) {
        logger.error('Failed to queue offline', { error });
        return { id: '', queued: false };
      }
    },
    []
  ); // No dependencies - uses only imported functions and setState

  // Ref to track timeout
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Reset form state
   */
  const reset = useCallback(() => {
    setIsSubmitting(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setSuccessMessage(null);
    setWasQueuedOffline(false);

    // Clear any pending timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  /**
   * Validate form data before submission
   */
  const validateBeforeSubmit = useCallback(
    async (data: ContactFormData): Promise<boolean> => {
      try {
        const result = contactSchema.safeParse(data);
        if (!result.success) {
          const firstError = result.error.issues[0];
          const errorMessage = firstError?.message || 'Validation failed';
          setError(errorMessage);
          setIsError(true);
          onError?.(new Error(errorMessage));
          return false;
        }
        return true;
      } catch (err) {
        const errorMessage = 'Validation error occurred';
        setError(errorMessage);
        setIsError(true);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
        return false;
      }
    },
    [onError]
  );

  /**
   * Submit form data
   */
  const submitForm = useCallback(
    async (data: ContactFormData): Promise<void> => {
      // Reset previous state
      reset();

      // Rate limiting is now handled by the email service

      // Set submitting state
      setIsSubmitting(true);

      try {
        // Check if offline
        if (!isOnline) {
          logger.info('Offline - queuing submission');

          // Add to offline queue
          const result = await addToOfflineQueue(data);

          if (result.queued) {
            setIsSuccess(true);
            setWasQueuedOffline(true);
            setSuccessMessage(
              'Message queued for sending when online. It will be sent automatically when connection is restored.'
            );

            // Auto-reset after delay
            if (autoResetDelay > 0) {
              resetTimeoutRef.current = setTimeout(reset, autoResetDelay);
            }
          } else {
            throw new Error('Failed to queue message. Please try again.');
          }

          setIsSubmitting(false);
          return;
        }

        // Submit form through email service (with failover and retry)
        const emailData: EmailContactFormData = {
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        };

        const result = await emailService.send(emailData);

        // Update state
        setIsSuccess(true);
        const providerNote =
          result.provider !== 'Web3Forms'
            ? ` (sent via backup: ${result.provider})`
            : '';
        setSuccessMessage(
          customSuccessMessage || `Email sent successfully${providerNote}`
        );

        // Call success callback with Web3FormsResponse format for compatibility
        const response: Web3FormsResponse = {
          success: result.success,
          message: `Email sent via ${result.provider}`,
          data: {
            from_name: data.name,
            from_email: data.email,
            subject: data.subject,
            message: data.message,
          },
        };
        onSuccess?.(response);

        // Auto-reset after delay if enabled
        if (autoResetDelay > 0) {
          resetTimeoutRef.current = setTimeout(() => {
            reset();
          }, autoResetDelay);
        }
      } catch (err) {
        // Handle error
        const errorObj =
          err instanceof Error ? err : new Error('Unknown error occurred');
        const formattedError =
          customErrorMessage || formatErrorMessage(errorObj);

        setError(formattedError);
        setIsError(true);

        // Call error callback
        onError?.(errorObj);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      onSuccess,
      onError,
      customSuccessMessage,
      customErrorMessage,
      autoResetDelay,
      reset,
      isOnline,
      addToOfflineQueue,
    ]
  );

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  return {
    submitForm,
    validateBeforeSubmit,
    reset,
    isSubmitting,
    isSuccess,
    isError,
    error,
    successMessage,
    isOnline,
    queueCount,
    wasQueuedOffline,
  };
};
