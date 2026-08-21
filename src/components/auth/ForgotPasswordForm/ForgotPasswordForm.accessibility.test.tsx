import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ForgotPasswordForm from './ForgotPasswordForm';

describe('ForgotPasswordForm Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ForgotPasswordForm />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  /**
   * #867 — a validation error must be tied to the field it is about.
   *
   * This was a generator stub containing only example comments: it rendered the form
   * and asserted NOTHING, in the file whose job is accessibility. Same shape as the two
   * found in #866.
   */
  it('ties the email validation error to the email field', async () => {
    render(<ForgotPasswordForm />);

    const email = screen.getByLabelText(/email/i);
    // `a@b` is deliberate: type="email" ACCEPTS it, so the browser's own validation does
    // not block submission, but `validateEmail` rejects it (a dot in the domain and a 2+
    // alpha TLD are required). A value the browser rejects never reaches React at all.
    await userEvent.type(email, 'a@b');
    await userEvent.click(
      screen.getByRole('button', { name: /send reset link/i })
    );

    // NOT findByRole('alert') — this form carries an empty live region, so that query
    // resolves to a container with no text and the assertion proves nothing (#850).
    // Follow the association instead; it is the property under test.
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));

    const describedBy = email.getAttribute('aria-describedby');
    expect(describedBy, 'the email input must point at its error').toBeTruthy();
    const slot = document.getElementById(describedBy!);
    expect(slot, `no element with id="${describedBy}"`).not.toBeNull();
    expect(slot!.textContent?.trim()).toBeTruthy();
    expect(slot!.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<ForgotPasswordForm />);

    // Test keyboard navigation
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element: Element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<ForgotPasswordForm />);

    // Axe will check color contrast
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<ForgotPasswordForm />);

    // Check for screen reader support
    // Example: Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img: Element) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
