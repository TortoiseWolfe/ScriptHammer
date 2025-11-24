import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactForm } from './ContactForm';
import * as useWeb3FormsModule from '@/hooks/useWeb3Forms';

// Mock the useWeb3Forms hook
vi.mock('@/hooks/useWeb3Forms', () => ({
  useWeb3Forms: vi.fn(),
}));

describe('ContactForm', () => {
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

  describe('Rendering', () => {
    it('should render all form fields', () => {
      render(<ContactForm />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /send message/i })
      ).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<ContactForm className="custom-class" />);
      const form = container.querySelector('form');
      expect(form).toHaveClass('custom-class');
    });

    it('should have proper ARIA attributes', () => {
      render(<ContactForm />);

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Contact form');

      const nameInput = screen.getByLabelText(/full name/i);
      expect(nameInput).toHaveAttribute('aria-required', 'true');
      // aria-describedby only present when there are errors, not initially
    });

    it('should include honeypot field for spam protection', () => {
      const { container } = render(<ContactForm />);
      const honeypot = container.querySelector('input[name="_gotcha"]');
      expect(honeypot).toBeInTheDocument();
      // Check the parent div has the hiding styles
      const parentDiv = honeypot?.parentElement;
      expect(parentDiv).toHaveStyle({ position: 'absolute', left: '-9999px' });
    });

    describe('Form Validation', () => {
      it('should show validation errors on invalid input', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        const nameInput = screen.getByLabelText(/full name/i);
        const submitButton = screen.getByRole('button', {
          name: /send message/i,
        });

        // Enter invalid name (too short)
        await user.type(nameInput, 'J');

        // Try to submit with invalid data
        await user.click(submitButton);

        // Should show error message after submit attempt
        await waitFor(() => {
          expect(
            screen.getByText(/name must be at least 2 characters/i)
          ).toBeInTheDocument();
        });

        // Form should not have been submitted
        expect(mockSubmitForm).not.toHaveBeenCalled();
      });

      it('should validate email format', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        const emailInput = screen.getByLabelText(/email address/i);
        const submitButton = screen.getByRole('button', {
          name: /send message/i,
        });

        await user.type(emailInput, 'invalid-email');

        // Try to submit with invalid email
        await user.click(submitButton);

        await waitFor(() => {
          expect(
            screen.getByText(/please enter a valid email address/i)
          ).toBeInTheDocument();
        });
      });

      it('should validate message length', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        const messageInput = screen.getByLabelText(/message/i);
        const submitButton = screen.getByRole('button', {
          name: /send message/i,
        });

        await user.type(messageInput, 'Too short');

        // Try to submit with short message
        await user.click(submitButton);

        await waitFor(() => {
          expect(
            screen.getByText(/message must be at least 10 characters/i)
          ).toBeInTheDocument();
        });
      });

      it('should clear errors when input becomes valid', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        const nameInput = screen.getByLabelText(/full name/i);
        const submitButton = screen.getByRole('button', {
          name: /send message/i,
        });

        // Enter invalid name and try to submit
        await user.type(nameInput, 'J');
        await user.click(submitButton);

        await waitFor(() => {
          expect(
            screen.getByText(/name must be at least 2 characters/i)
          ).toBeInTheDocument();
        });

        // Fix the error
        await user.clear(nameInput);
        await user.type(nameInput, 'John Doe');
        await user.tab(); // Trigger revalidation

        await waitFor(() => {
          expect(
            screen.queryByText(/name must be at least 2 characters/i)
          ).not.toBeInTheDocument();
        });
      });
    });

    describe('Form Submission', () => {
      it('should submit valid form data', async () => {
        const user = userEvent.setup();
        mockSubmitForm.mockResolvedValue(undefined);

        render(<ContactForm />);

        // Fill out form
        // Fill out form with proper validation triggers
        const nameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email address/i);
        const subjectInput = screen.getByLabelText(/subject/i);
        const messageInput = screen.getByLabelText(/message/i);

        await user.type(nameInput, 'John Doe');
        await user.tab();

        await user.type(emailInput, 'john@example.com');
        await user.tab();

        await user.type(subjectInput, 'Test Subject');
        await user.tab();

        await user.type(messageInput, 'This is a test message');
        await user.tab();

        // Submit button should always be enabled now (no isValid check)
        const submitButton = screen.getByRole('button', {
          name: /send message/i,
        });
        expect(submitButton).not.toBeDisabled();

        // Submit form
        await user.click(submitButton);

        await waitFor(() => {
          expect(mockSubmitForm).toHaveBeenCalledWith({
            name: 'John Doe',
            email: 'john@example.com',
            subject: 'Test Subject',
            message: 'This is a test message',
            _gotcha: '',
          });
        });
      });

      it('should show loading state during submission', async () => {
        vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
          ...defaultHookReturn,
          isSubmitting: true,
        });

        render(<ContactForm />);

        const submitButton = screen.getByRole('button', { name: /sending/i });
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveClass('loading');
      });

      it('should display success message after successful submission', () => {
        vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
          ...defaultHookReturn,
          isSuccess: true,
          successMessage: 'Your message has been sent successfully!',
        });

        render(<ContactForm />);

        expect(screen.getByRole('alert')).toHaveClass('alert-success');
        expect(
          screen.getByText(/your message has been sent successfully/i)
        ).toBeInTheDocument();
      });

      it('should display error message on submission failure', () => {
        vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
          ...defaultHookReturn,
          isError: true,
          error: 'Network error. Please try again.',
        });

        render(<ContactForm />);

        expect(screen.getByRole('alert')).toHaveClass('alert-error');
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      it('should reset form after successful submission', async () => {
        const user = userEvent.setup();

        // Start with success state
        const { rerender } = render(<ContactForm />);

        vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
          ...defaultHookReturn,
          isSuccess: true,
          successMessage: 'Message sent!',
        });

        rerender(<ContactForm />);

        expect(screen.getByText(/message sent/i)).toBeInTheDocument();

        // Click reset/dismiss button if present
        const dismissButton = screen.queryByRole('button', {
          name: /dismiss/i,
        });
        if (dismissButton) {
          await user.click(dismissButton);
          expect(mockReset).toHaveBeenCalled();
        }
      });

      it('should handle submission with custom callbacks', async () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();

        render(<ContactForm onSuccess={onSuccess} onError={onError} />);

        // Verify hooks were called with callbacks
        expect(useWeb3FormsModule.useWeb3Forms).toHaveBeenCalledWith(
          expect.objectContaining({
            onSuccess,
            onError,
          })
        );
      });
    });

    describe('Accessibility', () => {
      // Keyboard navigation test moved to E2E: e2e/accessibility/contact-form-keyboard.spec.ts
      // jsdom cannot properly simulate focus behavior - requires real browser DOM

      it('should announce errors to screen readers', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        const nameInput = screen.getByLabelText(/full name/i);
        const submitButton = screen.getByRole('button', {
          name: /send message/i,
        });

        await user.type(nameInput, 'J');

        // Try to submit with invalid data
        await user.click(submitButton);

        await waitFor(() => {
          const errorMessage = screen.getByText(
            /name must be at least 2 characters/i
          );
          expect(errorMessage).toHaveAttribute('role', 'alert');
          expect(errorMessage).toHaveAttribute('aria-live', 'polite');
        });
      });

      it('should have proper form landmarks', () => {
        render(<ContactForm />);

        const form = screen.getByRole('form');
        expect(form).toBeInTheDocument();

        // Check for proper heading structure
        const heading = screen.getByRole('heading', { name: /contact us/i });
        expect(heading).toBeInTheDocument();
      });
    });

    describe('Spam Protection', () => {
      it('should not submit if honeypot field is filled', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        const honeypot = document.querySelector(
          'input[name="_gotcha"]'
        ) as HTMLInputElement;

        // Simulate bot filling honeypot
        fireEvent.change(honeypot, { target: { value: 'bot-filled-this' } });

        // Fill other fields
        await user.type(screen.getByLabelText(/full name/i), 'John Doe');
        await user.type(
          screen.getByLabelText(/email address/i),
          'john@example.com'
        );
        await user.type(screen.getByLabelText(/subject/i), 'Test');
        await user.type(screen.getByLabelText(/message/i), 'Test message');

        // Try to submit
        await user.click(screen.getByRole('button', { name: /send message/i }));

        // Should not submit
        expect(mockSubmitForm).not.toHaveBeenCalled();
        expect(screen.getByText(/bot detected/i)).toBeInTheDocument();
      });
    });

    describe('Field Attributes', () => {
      it('should have correct input types and attributes', () => {
        render(<ContactForm />);

        const nameInput = screen.getByLabelText(
          /full name/i
        ) as HTMLInputElement;
        expect(nameInput).toHaveAttribute('type', 'text');
        expect(nameInput).toHaveAttribute('required');
        expect(nameInput).toHaveAttribute('maxLength', '100');

        const emailInput = screen.getByLabelText(
          /email address/i
        ) as HTMLInputElement;
        expect(emailInput).toHaveAttribute('type', 'email');
        expect(emailInput).toHaveAttribute('required');

        const messageInput = screen.getByLabelText(
          /message/i
        ) as HTMLTextAreaElement;
        expect(messageInput.tagName).toBe('TEXTAREA');
        expect(messageInput).toHaveAttribute('required');
        expect(messageInput).toHaveAttribute('maxLength', '5000');
      });

      it('should have autocomplete attributes', () => {
        render(<ContactForm />);

        expect(screen.getByLabelText(/full name/i)).toHaveAttribute(
          'autoComplete',
          'name'
        );
        expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
          'autoComplete',
          'email'
        );
      });
    });
  });
});
