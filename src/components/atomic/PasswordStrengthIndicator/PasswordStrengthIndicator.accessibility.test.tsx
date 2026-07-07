import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import PasswordStrengthIndicator from './';

describe('PasswordStrengthIndicator Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <PasswordStrengthIndicator password="MyP@ssw0rd123!" />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="Password1" />
    );

    const status = container.querySelector('[role="status"]');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-label', 'Password strength: Medium');
  });

  it('should be keyboard navigable', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="Password1" />
    );

    // This component is display-only (status indicator)
    // It should not have interactive elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // Should have 0 interactive elements (it's a status display)
    expect(focusableElements).toHaveLength(0);
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(
      <PasswordStrengthIndicator password="MyP@ssw0rd123!" />
    );

    // Axe will check color contrast
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support screen readers', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="Password1" />
    );

    // Check for screen reader support via ARIA
    const status = container.querySelector('[role="status"]');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-label');
  });

  it('should have no violations when password is empty (returns null)', async () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);

    // Component returns null, so container should be empty
    expect(container.firstChild).toBeNull();

    // Axe should have no violations on empty container
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should update ARIA label when password strength changes', () => {
    const { container, rerender } = render(
      <PasswordStrengthIndicator password="abc" />
    );

    let status = container.querySelector('[role="status"]');
    expect(status).toHaveAttribute('aria-label', 'Password strength: Weak');

    rerender(<PasswordStrengthIndicator password="MyP@ssw0rd123!" />);

    status = container.querySelector('[role="status"]');
    expect(status).toHaveAttribute('aria-label', 'Password strength: Strong');
  });
});
