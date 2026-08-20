import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import SignUpForm from './SignUpForm';

describe('SignUpForm Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<SignUpForm />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  /**
   * #857 — each validation error must reach the field it is about.
   *
   * This was a generator stub containing only example comments: it rendered the
   * form and asserted nothing, in the file whose job is accessibility.
   *
   * SignUpForm is the sharper case of the two. THREE distinct client-side
   * conditions used to funnel into one form-level alert with no `id` — an invalid
   * email, a short password, and a mismatched confirmation — so "Passwords do not
   * match" was announced with nothing saying which of the two password boxes to
   * fix. Getting the association merely present is not enough here; it has to
   * land on the RIGHT field, which is what the loop below pins.
   */
  it.each([
    {
      case: 'invalid email',
      // `a@b` passes the browser's own `type="email"` check but fails
      // `validateEmail` (it requires a dot in the domain and a 2+ alpha TLD).
      // A value the browser rejects never reaches React at all.
      fill: {
        email: 'a@b',
        password: 'LongEnough123',
        confirm: 'LongEnough123',
      },
      field: 'email',
      others: ['password', 'confirm-password'],
    },
    {
      case: 'short password',
      fill: { email: 'real@example.com', password: 'short', confirm: 'short' },
      field: 'password',
      others: ['email', 'confirm-password'],
    },
    {
      case: 'mismatched confirmation',
      fill: {
        email: 'real@example.com',
        password: 'LongEnough123',
        confirm: 'Different123',
      },
      // Announced against the CONFIRMATION box, not the password: that is the
      // one the user is being asked to change.
      field: 'confirm-password',
      others: ['email', 'password'],
    },
  ])('announces the $case against its own field', async (scenario) => {
    render(<SignUpForm />);

    // Selected by id, not by label text: `getByLabelText(/^password/i)` matches
    // more than one control here (the strength indicator contributes text), and
    // the ids are exactly what the aria-describedby wiring under test refers to.
    const byId = (id: string) =>
      document.getElementById(id) as HTMLInputElement;

    await userEvent.type(byId('email'), scenario.fill.email);
    await userEvent.type(byId('password'), scenario.fill.password);
    await userEvent.type(byId('confirm-password'), scenario.fill.confirm);
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    const target = byId(scenario.field);
    await waitFor(() => expect(target).toHaveAttribute('aria-invalid', 'true'));

    const describedBy = target.getAttribute('aria-describedby');
    expect(describedBy, 'the field must point at its error').toBeTruthy();
    const slot = document.getElementById(describedBy!);
    expect(slot, `no element with id="${describedBy}"`).not.toBeNull();
    expect(slot!.textContent?.trim()).toBeTruthy();
    expect(slot!.querySelector('[role="alert"]')).not.toBeNull();

    // The half that makes this test worth having: the OTHER fields must stay
    // clean. An implementation that marked every input invalid would satisfy the
    // assertions above and still tell the user nothing.
    for (const other of scenario.others) {
      const el = byId(other);
      expect(el, `${other} should not be marked invalid`).not.toHaveAttribute(
        'aria-invalid',
        'true'
      );
      expect(el).not.toHaveAttribute('aria-describedby');
    }
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<SignUpForm />);

    // Test keyboard navigation
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element: Element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<SignUpForm />);

    // Axe will check color contrast
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<SignUpForm />);

    // Check for screen reader support
    // Example: Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img: Element) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
