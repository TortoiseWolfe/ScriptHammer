import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import SignInForm from './SignInForm';

describe('SignInForm Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<SignInForm />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  /**
   * #857 — a validation error must be tied to the field it is about.
   *
   * This test was a generator stub containing only example comments: it rendered
   * the form and asserted NOTHING, which is the #396 shape the #850 queue is
   * about, sitting in the file whose job is accessibility.
   *
   * What it now pins is the gap it was named for. Every error used to funnel into
   * one form-level alert with no `id`, and neither input carried `aria-invalid`
   * or `aria-describedby` — so a screen reader announced "Invalid email address"
   * with nothing connecting it to the email box.
   */
  it('ties a validation error to the field it is about', async () => {
    render(<SignInForm />);

    const email = screen.getByLabelText(/email/i);
    // `a@b` is deliberate: `type="email"` ACCEPTS it, so the browser's native
    // `required`/type validation does not block submission, but `validateEmail`
    // rejects it (email-validator.ts requires a dot in the domain plus a 2+
    // alphabetic TLD). Anything the browser itself rejects never reaches React,
    // and the test would assert against a form that never ran its own validation.
    await userEvent.type(email, 'a@b');
    await userEvent.type(screen.getByLabelText(/password/i), 'whatever123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Deliberately NOT `findByRole('alert')`. The form carries an empty
    // `role="alert"` live region, so that query resolves to a container with no
    // text and the assertion reads `Received: <empty>` — the same trap that made
    // accessibility.spec.ts:437 unable to see anything (#850). Follow the
    // association instead, which is the property under test.
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));

    const describedBy = email.getAttribute('aria-describedby');
    expect(describedBy, 'email input must point at its error').toBeTruthy();

    const slot = document.getElementById(describedBy!);
    expect(slot, `no element with id="${describedBy}"`).not.toBeNull();
    // Non-empty rather than an exact string. The message comes from
    // `validateEmail` and for `a@b` reads "Invalid or missing top-level domain
    // (TLD)" — it does not contain the word "email", which is what my first
    // version of this assertion wrongly assumed. Pinning the copy would break on
    // any wording change while proving nothing extra; what matters is that the
    // slot the input points at actually says something.
    expect(slot!.textContent?.trim()).toBeTruthy();
    // And it must be announced, not merely present.
    expect(slot!.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('leaves the sign-in failure form-level, NOT on the email field', async () => {
    // Deliberate asymmetry. The post-submit failure is generic to avoid account
    // enumeration; associating it with the email input would both mislead and
    // hint at which half of the credentials was wrong. Only client-side
    // validation is field-scoped.
    render(<SignInForm />);

    const email = screen.getByLabelText(/email/i);
    await userEvent.type(email, 'real@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'whatever123');

    expect(email).not.toHaveAttribute('aria-invalid', 'true');
    expect(email).not.toHaveAttribute('aria-describedby');
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<SignInForm />);

    // Test keyboard navigation
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element: Element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<SignInForm />);

    // Axe will check color contrast
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<SignInForm />);

    // Check for screen reader support
    // Example: Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img: Element) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
