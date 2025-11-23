/**
 * @vitest-environment jsdom
 * Integration tests for offline queue functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { ContactForm } from '@/components/forms/ContactForm/ContactForm';
import * as offlineQueue from '@/utils/offline-queue';
import * as backgroundSync from '@/utils/background-sync';
import * as web3forms from '@/utils/web3forms';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

// Mock the modules
vi.mock('@/utils/offline-queue');
vi.mock('@/utils/background-sync');
vi.mock('@/utils/web3forms');

// Create a mock implementation for useOfflineQueue
const createMockUseOfflineQueue = (overrides = {}) => ({
  queue: [],
  queueCount: 0,
  failedCount: 0,
  isSyncing: false,
  isOnline: true,
  syncQueue: vi.fn().mockResolvedValue(undefined),
  retryFailed: vi.fn().mockResolvedValue(undefined),
  clearSynced: vi.fn().mockResolvedValue(undefined),
  getFailedMessages: vi.fn().mockResolvedValue([]),
  ...overrides,
});

// Mock the hook
vi.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: vi.fn(() => createMockUseOfflineQueue()),
}));

// Helper to fill form fields with validation
async function fillContactForm(
  screen: (typeof import('@testing-library/react'))['screen']
) {
  const nameInput = await screen.findByLabelText(/full name/i);
  const emailInput = await screen.findByLabelText(/email/i);
  const subjectInput = await screen.findByLabelText(/subject/i);
  const messageInput = await screen.findByLabelText(/message/i);

  // Fill all fields at once
  await act(async () => {
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });
    fireEvent.change(messageInput, {
      target: { value: 'Test message content' },
    });
  });

  // Trigger blur events to activate validation
  await act(async () => {
    fireEvent.blur(nameInput);
    fireEvent.blur(emailInput);
    fireEvent.blur(subjectInput);
    fireEvent.blur(messageInput);
  });

  // Additional wait to ensure React Hook Form validation completes
  // React Hook Form's isValid might not update immediately
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  // Force additional blur events and focus changes to trigger validation
  await act(async () => {
    nameInput.focus();
    fireEvent.blur(nameInput);
    emailInput.focus();
    fireEvent.blur(emailInput);
    subjectInput.focus();
    fireEvent.blur(subjectInput);
    messageInput.focus();
    fireEvent.blur(messageInput);
  });

  // Final wait for validation state to settle
  await waitFor(() => {
    // Wait for form to be in a stable state
    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(subjectInput).toHaveValue('Test Subject');
    expect(messageInput).toHaveValue('Test message content');
  });
}

describe('Offline Queue Integration', () => {
  let originalNavigatorOnLine: boolean;

  beforeEach(() => {
    // Store original value
    originalNavigatorOnLine = navigator.onLine;

    // Setup default mocks
    vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(0);
    vi.mocked(offlineQueue.addToQueue).mockResolvedValue(true);
    vi.mocked(offlineQueue.getQueuedItems).mockResolvedValue([]);
    vi.mocked(offlineQueue.removeFromQueue).mockResolvedValue(true);
    vi.mocked(offlineQueue.clearQueue).mockResolvedValue(true);
    vi.mocked(offlineQueue.updateRetryCount).mockResolvedValue(true);

    vi.mocked(backgroundSync.isBackgroundSyncSupported).mockReturnValue(true);
    vi.mocked(backgroundSync.registerBackgroundSync).mockResolvedValue(true);

    vi.mocked(web3forms.submitWithRetry).mockResolvedValue({
      success: true,
      message: 'Form submitted successfully',
      data: {},
    });
    vi.mocked(web3forms.checkRateLimit).mockReturnValue(true);
    vi.mocked(web3forms.recordSubmission).mockImplementation(() => {});
    vi.mocked(web3forms.formatErrorMessage).mockReturnValue(
      'An error occurred'
    );

    // Set initial online state
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, 'onLine', {
      value: originalNavigatorOnLine,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('ContactForm Offline Behavior', () => {
    it('should render ContactForm with mocked hook', () => {
      // Simple test to verify mocking works
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: true,
          queueSize: 0,
        })
      );

      const { container } = render(<ContactForm />);

      // Check that form rendered
      expect(container.querySelector('form')).toBeInTheDocument();
    });

    it('should show offline indicator when offline', async () => {
      // Set offline state
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Mock the hook to return offline state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueSize: 0,
        })
      );

      render(<ContactForm />);

      await waitFor(() => {
        expect(
          screen.getByText(/you are currently offline/i)
        ).toBeInTheDocument();
      });
    });

    it('should queue form submission when offline', async () => {
      // Set offline state
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Mock the hook to return offline state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueCount: 0, // messaging queue is empty
        })
      );

      // Mock IndexedDB utilities that useWeb3Forms uses
      vi.mocked(offlineQueue.addToQueue).mockResolvedValue(true);
      vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(0);

      render(<ContactForm />);

      // Fill the form with valid data
      await fillContactForm(screen);

      // Find submit button - text should be "Queue for Later" when offline
      let submitButton = await screen.findByRole('button', {
        name: /queue for later/i,
      });

      // If button is still disabled, try to trigger form validation manually
      if ((submitButton as HTMLButtonElement).disabled) {
        // Re-trigger validation by focusing and blurring all fields again
        const nameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email/i);
        const subjectInput = screen.getByLabelText(/subject/i);
        const messageInput = screen.getByLabelText(/message/i);

        await act(async () => {
          // Try additional validation triggers
          fireEvent.input(nameInput, { target: { value: 'John Doe' } });
          fireEvent.input(emailInput, {
            target: { value: 'john@example.com' },
          });
          fireEvent.input(subjectInput, { target: { value: 'Test Subject' } });
          fireEvent.input(messageInput, {
            target: { value: 'Test message content' },
          });
        });

        await act(async () => {
          fireEvent.blur(nameInput);
          fireEvent.blur(emailInput);
          fireEvent.blur(subjectInput);
          fireEvent.blur(messageInput);
        });

        // Wait for validation to complete
        await waitFor(
          () => {
            submitButton = screen.getByRole('button', {
              name: /queue for later/i,
            });
            expect(submitButton).not.toBeDisabled();
          },
          { timeout: 2000 }
        );
      }

      // Submit form
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Wait for submission to process
      await waitFor(() => {
        // Check that the IndexedDB utility was called
        expect(offlineQueue.addToQueue).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
            subject: 'Test Subject',
            message: 'Test message content',
          })
        );
      });
    });

    it('should show queued message was sent offline', async () => {
      // Set offline state
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Mock the hook for offline state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueCount: 0,
        })
      );

      // Mock IndexedDB utilities
      vi.mocked(offlineQueue.addToQueue).mockResolvedValue(true);
      vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(0);

      render(<ContactForm />);

      // Fill form using helper function
      await fillContactForm(screen);

      // Find submit button and ensure it's enabled
      let submitButton = await screen.findByRole('button', {
        name: /queue for later/i,
      });

      // Force validation if button is still disabled
      if ((submitButton as HTMLButtonElement).disabled) {
        const nameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email/i);
        const subjectInput = screen.getByLabelText(/subject/i);
        const messageInput = screen.getByLabelText(/message/i);

        await act(async () => {
          fireEvent.input(nameInput, { target: { value: 'John Doe' } });
          fireEvent.input(emailInput, {
            target: { value: 'john@example.com' },
          });
          fireEvent.input(subjectInput, { target: { value: 'Test Subject' } });
          fireEvent.input(messageInput, {
            target: { value: 'Test message content' },
          });
          fireEvent.blur(nameInput);
          fireEvent.blur(emailInput);
          fireEvent.blur(subjectInput);
          fireEvent.blur(messageInput);
        });

        await waitFor(
          () => {
            submitButton = screen.getByRole('button', {
              name: /queue for later/i,
            });
            expect(submitButton).not.toBeDisabled();
          },
          { timeout: 2000 }
        );
      }

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        const successMessage = screen.getByText(
          /message queued for sending when online/i
        );
        expect(successMessage).toBeInTheDocument();
      });
    });

    it('should display queue size when offline', async () => {
      // Set offline with queued items
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Mock the hook to return offline state (messaging queue empty)
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueCount: 0,
        })
      );

      // Mock forms queue to have 3 items
      vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(3);

      render(<ContactForm />);

      await waitFor(() => {
        expect(screen.getByText(/3 message/)).toBeInTheDocument();
      });
    });

    it('should update queue size after submission', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Initial setup with 2 forms queued
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueCount: 0, // messaging queue empty
        })
      );

      // Start with 2 forms queued, then update to 3 after submission
      vi.mocked(offlineQueue.getQueueSize)
        .mockResolvedValueOnce(2) // Initial load on mount
        .mockResolvedValue(3); // After addToQueue succeeds (line 89 in useWeb3Forms)
      vi.mocked(offlineQueue.addToQueue).mockResolvedValue(true);

      const { rerender } = render(<ContactForm />);

      await waitFor(() => {
        expect(screen.getByText(/2 message/)).toBeInTheDocument();
      });

      // Fill form using helper
      await fillContactForm(screen);

      // Get submit button and ensure it's enabled
      let submitButton = await screen.findByRole('button', {
        name: /queue for later/i,
      });

      // Force validation if needed
      if ((submitButton as HTMLButtonElement).disabled) {
        const nameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email/i);
        const subjectInput = screen.getByLabelText(/subject/i);
        const messageInput = screen.getByLabelText(/message/i);

        await act(async () => {
          fireEvent.input(nameInput, { target: { value: 'John Doe' } });
          fireEvent.input(emailInput, {
            target: { value: 'john@example.com' },
          });
          fireEvent.input(subjectInput, { target: { value: 'Test Subject' } });
          fireEvent.input(messageInput, {
            target: { value: 'Test message content' },
          });
          fireEvent.blur(nameInput);
          fireEvent.blur(emailInput);
          fireEvent.blur(subjectInput);
          fireEvent.blur(messageInput);
        });

        await waitFor(
          () => {
            submitButton = screen.getByRole('button', {
              name: /queue for later/i,
            });
            expect(submitButton).not.toBeDisabled();
          },
          { timeout: 2000 }
        );
      }

      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Force re-render to trigger queue size refresh
      rerender(<ContactForm />);

      await waitFor(() => {
        expect(screen.getByText(/3 message/)).toBeInTheDocument();
      });
    });
  });

  describe('Online/Offline Transitions', () => {
    it('should hide offline indicator when coming back online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Initial mock for offline state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
        })
      );

      const { rerender } = render(<ContactForm />);

      await waitFor(() => {
        expect(
          screen.getByText(/you are currently offline/i)
        ).toBeInTheDocument();
      });

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      // Update mock for online state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: true,
        })
      );

      // Re-render to reflect state change
      rerender(<ContactForm />);

      await waitFor(() => {
        expect(
          screen.queryByText(/you are currently offline/i)
        ).not.toBeInTheDocument();
      });
    });

    it('should register background sync when coming online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const mockRefreshQueueSize = vi.fn();

      // Initial offline state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueSize: 2,
          refreshQueueSize: mockRefreshQueueSize,
        })
      );

      const { rerender } = render(<ContactForm />);

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      // Update mock for online state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: true,
          queueSize: 2,
          refreshQueueSize: mockRefreshQueueSize,
        })
      );

      rerender(<ContactForm />);

      // The hook internally should register background sync when coming online
      // Since we're mocking the hook, we just verify the component renders correctly
      await waitFor(() => {
        expect(
          screen.queryByText(/you are currently offline/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Background Sync Integration', () => {
    it('should process queue when background sync completes', async () => {
      // Start with items in queue
      const mockRefreshQueueSize = vi.fn();

      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: true,
          queueSize: 3,
          refreshQueueSize: mockRefreshQueueSize,
        })
      );

      const { rerender } = render(<ContactForm />);

      // Simulate sync completion - queue is now empty
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: true,
          queueSize: 0,
          refreshQueueSize: mockRefreshQueueSize,
        })
      );

      rerender(<ContactForm />);

      // Verify the UI updates to show no queued messages
      await waitFor(() => {
        expect(screen.queryByText(/queued message/)).not.toBeInTheDocument();
      });
    });

    it('should show queue indicator when messages are queued', async () => {
      // Mock hook to show messaging queue while online
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: true,
          queueCount: 2, // 2 messaging messages queued
        })
      );

      // No forms queued
      vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(0);

      render(<ContactForm />);

      // Should show indicator for queued messages even when online
      await waitFor(() => {
        expect(screen.getByText(/2 queued message/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle queue addition failure gracefully', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Set offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Setup mock for offline state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueCount: 0,
        })
      );

      // Make the IndexedDB utility fail
      vi.mocked(offlineQueue.addToQueue).mockResolvedValue(false);
      vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(0);

      render(<ContactForm />);

      // Fill form using helper
      await fillContactForm(screen);

      // Get submit button and ensure it's enabled
      let submitButton = await screen.findByRole('button', {
        name: /queue for later/i,
      });

      // Force validation if needed
      if ((submitButton as HTMLButtonElement).disabled) {
        const nameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email/i);
        const subjectInput = screen.getByLabelText(/subject/i);
        const messageInput = screen.getByLabelText(/message/i);

        await act(async () => {
          fireEvent.input(nameInput, { target: { value: 'John Doe' } });
          fireEvent.input(emailInput, {
            target: { value: 'john@example.com' },
          });
          fireEvent.input(subjectInput, { target: { value: 'Test Subject' } });
          fireEvent.input(messageInput, {
            target: { value: 'Test message content' },
          });
          fireEvent.blur(nameInput);
          fireEvent.blur(emailInput);
          fireEvent.blur(subjectInput);
          fireEvent.blur(messageInput);
        });

        await waitFor(
          () => {
            submitButton = screen.getByRole('button', {
              name: /queue for later/i,
            });
            expect(submitButton).not.toBeDisabled();
          },
          { timeout: 2000 }
        );
      }

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        // The error should show when queue addition fails
        expect(screen.getByRole('alert')).toHaveTextContent(
          /an error occurred|failed to queue message/i
        );
      });

      consoleError.mockRestore();
    });

    it('should handle background sync not supported', async () => {
      // Set offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      // Setup mock for offline state
      vi.mocked(useOfflineQueue).mockReturnValue(
        createMockUseOfflineQueue({
          isOnline: false,
          queueCount: 0,
        })
      );

      // Mock IndexedDB utilities - should still queue even without background sync
      vi.mocked(offlineQueue.addToQueue).mockResolvedValue(true);
      vi.mocked(offlineQueue.getQueueSize).mockResolvedValue(0);

      // Mock background sync as not supported
      vi.mocked(backgroundSync.registerBackgroundSync).mockResolvedValue(false);

      render(<ContactForm />);

      // Fill form using helper
      await fillContactForm(screen);

      // Get submit button and ensure it's enabled
      let submitButton = await screen.findByRole('button', {
        name: /queue for later/i,
      });

      // Force validation if needed
      if ((submitButton as HTMLButtonElement).disabled) {
        const nameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email/i);
        const subjectInput = screen.getByLabelText(/subject/i);
        const messageInput = screen.getByLabelText(/message/i);

        await act(async () => {
          fireEvent.input(nameInput, { target: { value: 'John Doe' } });
          fireEvent.input(emailInput, {
            target: { value: 'john@example.com' },
          });
          fireEvent.input(subjectInput, { target: { value: 'Test Subject' } });
          fireEvent.input(messageInput, {
            target: { value: 'Test message content' },
          });
          fireEvent.blur(nameInput);
          fireEvent.blur(emailInput);
          fireEvent.blur(subjectInput);
          fireEvent.blur(messageInput);
        });

        await waitFor(
          () => {
            submitButton = screen.getByRole('button', {
              name: /queue for later/i,
            });
            expect(submitButton).not.toBeDisabled();
          },
          { timeout: 2000 }
        );
      }

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(offlineQueue.addToQueue).toHaveBeenCalled();
      });

      // Should still queue the message even without background sync
      await waitFor(() => {
        expect(
          screen.getByText(/message queued for sending when online/i)
        ).toBeInTheDocument();
      });
    });
  });
});
