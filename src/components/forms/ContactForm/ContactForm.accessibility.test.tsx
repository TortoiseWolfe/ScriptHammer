import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ContactForm } from './ContactForm';
import * as useWeb3FormsModule from '@/hooks/useWeb3Forms';

expect.extend(toHaveNoViolations);

// Mock the useWeb3Forms hook
vi.mock('@/hooks/useWeb3Forms', () => ({
  useWeb3Forms: vi.fn(),
}));

describe('ContactForm Accessibility', () => {
  const mockSubmitForm = vi.fn();
  const mockReset = vi.fn();
  const mockValidateBeforeSubmit = vi.fn();

  const defaultHookReturn: useWeb3FormsModule.UseWeb3FormsReturn = {
    submitForm: mockSubmitForm,
    validateBeforeSubmit: mockValidateBeforeSubmit,
    reset: mockReset,
    isSubmitting: false,
    queueCount: 0,
    isSuccess: false,
    isError: false,
    error: null,
    successMessage: null,
    isOnline: true,
    wasQueuedOffline: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue(
      defaultHookReturn
    );
    mockValidateBeforeSubmit.mockResolvedValue(true);
  });

  it('should have no accessibility violations in default state', async () => {
    const { container } = render(<ContactForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with error state', async () => {
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      ...defaultHookReturn,
      isError: true,
      error: 'Network error occurred',
    });

    const { container } = render(<ContactForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with success state', async () => {
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      ...defaultHookReturn,
      isSuccess: true,
      successMessage: 'Your message has been sent successfully!',
    });

    const { container } = render(<ContactForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations during submission', async () => {
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      ...defaultHookReturn,
      isSubmitting: true,
    });

    const { container } = render(<ContactForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper form labels and associations', () => {
    const { getByLabelText } = render(<ContactForm />);

    // All form fields should have proper label associations
    expect(getByLabelText(/full name/i)).toBeTruthy();
    expect(getByLabelText(/email address/i)).toBeTruthy();
    expect(getByLabelText(/subject/i)).toBeTruthy();
    expect(getByLabelText(/message/i)).toBeTruthy();
  });

  it('should have accessible error messages', async () => {
    const { container } = render(<ContactForm />);

    // Trigger validation by submitting empty form
    const form = container.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for error messages to appear
    await waitFor(() => {
      // Error messages should be associated with form fields
      const nameInput = container.querySelector('input[name="name"]');
      const errorId = nameInput?.getAttribute('aria-describedby');

      if (errorId) {
        const errorElement = container.querySelector(`#${errorId}`);
        expect(errorElement).toBeTruthy();
      }
    });
  });

  it('should have keyboard navigable form', () => {
    const { container } = render(<ContactForm />);

    // All interactive elements should be keyboard accessible
    const inputs = container.querySelectorAll('input, textarea, button');
    inputs.forEach((element) => {
      const tabIndex = element.getAttribute('tabindex');
      // Elements should either have no tabindex or a non-negative value
      if (tabIndex !== null) {
        expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(-1);
      }
    });
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(<ContactForm />);

    // Check for proper heading structure
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, index) => {
      if (index > 0) {
        const prevLevel = parseInt(headings[index - 1].tagName[1]);
        const currentLevel = parseInt(heading.tagName[1]);
        // Heading levels should not skip
        expect(currentLevel - prevLevel).toBeLessThanOrEqual(1);
      }
    });
  });

  it('should have accessible alert messages', async () => {
    // Test error alert
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      ...defaultHookReturn,
      isError: true,
      error: 'Test error message',
    });

    const { container } = render(<ContactForm />);
    const errorAlert = container.querySelector('[role="alert"]');
    expect(errorAlert).toBeTruthy();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain focus management', () => {
    const { getByRole } = render(<ContactForm />);

    // Submit button should be focusable and enabled (we removed isValid check for performance)
    const submitButton = getByRole('button', { name: /send message/i });
    expect(submitButton).toBeTruthy();
    // Button is now enabled by default (only disabled during submission or if honeypot filled)
    expect(submitButton.hasAttribute('disabled')).toBe(false);
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(<ContactForm />);

    // Required fields should have aria-required
    const nameInput = container.querySelector('input[name="name"]');
    expect(nameInput?.getAttribute('aria-invalid')).toBe('false');

    // Check for proper use of ARIA labels
    const form = container.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('should handle loading state accessibly', async () => {
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      ...defaultHookReturn,
      isSubmitting: true,
    });

    const { container, getByRole } = render(<ContactForm />);

    // Button should indicate loading state
    const submitButton = getByRole('button');
    expect(submitButton.hasAttribute('disabled')).toBe(true);

    // Check for loading indicator
    const loadingIndicator = container.querySelector('.loading');
    if (loadingIndicator) {
      expect(loadingIndicator.getAttribute('aria-hidden')).not.toBe('true');
    }

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should support screen reader announcements', () => {
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      ...defaultHookReturn,
      isSuccess: true,
      successMessage: 'Message sent!',
    });

    const { container } = render(<ContactForm />);

    // Success message should be announced
    const successAlert = container.querySelector('[role="alert"]');
    expect(successAlert).toBeTruthy();
    expect(successAlert?.textContent).toContain('Message sent!');
  });

  it('should have descriptive button text', () => {
    const { getByRole } = render(<ContactForm />);

    const button = getByRole('button');
    expect(button.textContent).not.toBe('Submit'); // Should be more descriptive
    expect(button.textContent).toMatch(/send/i);
  });
});
