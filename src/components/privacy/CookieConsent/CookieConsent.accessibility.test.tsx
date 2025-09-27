import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CookieConsent } from './CookieConsent';
import { ConsentProvider } from '@/contexts/ConsentContext';

expect.extend(toHaveNoViolations);

describe('CookieConsent Accessibility', () => {
  const renderComponent = () => {
    return render(
      <ConsentProvider>
        <CookieConsent />
      </ConsentProvider>
    );
  };

  it('should have no accessibility violations', async () => {
    const { container } = renderComponent();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    renderComponent();
    const banner = screen.getByRole('region');
    expect(banner).toHaveAttribute('aria-label', 'Cookie consent banner');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Tab through interactive elements
    await user.tab();
    const acceptButton = screen.getByRole('button', { name: /accept/i });
    expect(acceptButton).toHaveFocus();

    // Reject All button removed in compact design - skip to Settings
    await user.tab();
    const customizeButton = screen.getByRole('button', { name: /customize/i });
    expect(customizeButton).toHaveFocus();
  });

  it('should have accessible button labels', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    // Reject All button removed in compact design
    expect(
      screen.getByRole('button', { name: /customize/i })
    ).toBeInTheDocument();
  });

  it('should announce changes to screen readers', () => {
    renderComponent();
    const banner = screen.getByRole('region');

    // aria-live="polite" ensures screen readers announce the banner
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('should have sufficient color contrast', () => {
    // This would typically be tested with tools like axe-core
    // which checks WCAG color contrast requirements
    renderComponent();

    // Verify buttons are using semantic classes that ensure contrast
    const acceptButton = screen.getByRole('button', { name: /accept all/i });
    expect(acceptButton).toHaveClass('btn-primary');
  });

  it('should be navigable with keyboard only', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    render(
      <ConsentProvider>
        <CookieConsent onAcceptAll={onAccept} />
      </ConsentProvider>
    );

    // Navigate to accept button and activate with Enter
    await user.tab();
    await user.keyboard('{Enter}');

    // Verify the action was triggered
    expect(onAccept).toHaveBeenCalled();
  });
});
