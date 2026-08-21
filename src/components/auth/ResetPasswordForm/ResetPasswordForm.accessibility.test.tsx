import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ResetPasswordForm from './ResetPasswordForm';

describe('ResetPasswordForm Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ResetPasswordForm />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  /**
   * #867 — each validation error must reach the field it is about.
   *
   * This was a generator stub asserting nothing. TWO conditions used to funnel into one
   * form-level alert with no `id` — a password that fails validation, and a mismatched
   * confirmation — so "Passwords do not match" was announced with nothing saying which
   * of the two boxes to fix.
   */
  it.each([
    {
      case: 'weak password',
      fill: { password: 'short', confirm: 'short' },
      field: 'password',
      other: 'confirm-password',
    },
    {
      case: 'mismatched confirmation',
      // BOTH must pass validatePassword (8+, upper, lower, number, SPECIAL) or the
      // password branch fires first and the mismatch is never reached — the test would
      // then assert against a state it never got to.
      fill: { password: 'LongEnough123!', confirm: 'Different123!' },
      // Announced against the CONFIRMATION box: that is the one being asked to change.
      field: 'confirm-password',
      other: 'password',
    },
  ])('announces the $case against its own field', async (scenario) => {
    render(<ResetPasswordForm />);

    // Selected by id, not label text: the ids are exactly what the aria-describedby
    // wiring under test refers to, and /password/i matches more than one control.
    const byId = (id: string) =>
      document.getElementById(id) as HTMLInputElement;

    await userEvent.type(byId('password'), scenario.fill.password);
    await userEvent.type(byId('confirm-password'), scenario.fill.confirm);
    await userEvent.click(
      screen.getByRole('button', { name: /reset password/i })
    );

    const target = byId(scenario.field);
    await waitFor(() => expect(target).toHaveAttribute('aria-invalid', 'true'));

    const describedBy = target.getAttribute('aria-describedby');
    expect(describedBy, 'the field must point at its error').toBeTruthy();
    const slot = document.getElementById(describedBy!);
    expect(slot, `no element with id="${describedBy}"`).not.toBeNull();
    expect(slot!.textContent?.trim()).toBeTruthy();
    expect(slot!.querySelector('[role="alert"]')).not.toBeNull();

    // The half that makes this worth having: the OTHER field stays clean. Marking every
    // input invalid would satisfy the assertions above and tell the user nothing.
    const other = byId(scenario.other);
    expect(other).not.toHaveAttribute('aria-invalid', 'true');
    expect(other).not.toHaveAttribute('aria-describedby');
  });

  it('should be keyboard navigable', () => {
    const { container } = render(<ResetPasswordForm />);

    // Test keyboard navigation
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element: Element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<ResetPasswordForm />);

    // Axe will check color contrast
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(<ResetPasswordForm />);

    // Check for screen reader support
    // Example: Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img: Element) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
