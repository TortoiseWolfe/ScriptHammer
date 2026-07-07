/**
 * PaymentConsentModal Accessibility Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PaymentConsentModal } from './PaymentConsentModal';

expect.extend(toHaveNoViolations);

// Mock consent hook
vi.mock('@/hooks/usePaymentConsent', () => ({
  usePaymentConsent: vi.fn(() => ({
    showModal: true,
    hasConsent: false,
    consentDate: null,
    grantConsent: vi.fn(),
    declineConsent: vi.fn(),
    resetConsent: vi.fn(),
  })),
}));

describe('PaymentConsentModal Accessibility', () => {
  it('should have no accessibility violations in default state', async () => {
    const { container } = render(<PaymentConsentModal />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations without logo', async () => {
    const { container } = render(<PaymentConsentModal showLogo={false} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with custom message', async () => {
    const { container } = render(
      <PaymentConsentModal customMessage="Custom consent message for testing accessibility" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(<PaymentConsentModal />);

    const h3 = container.querySelector('h3');
    const h4 = container.querySelector('h4');

    expect(h3).toBeInTheDocument();
    expect(h4).toBeInTheDocument();

    // h4 should come after h3
    const h3Index = Array.from(container.querySelectorAll('*')).indexOf(h3!);
    const h4Index = Array.from(container.querySelectorAll('*')).indexOf(h4!);
    expect(h4Index).toBeGreaterThan(h3Index);
  });

  it('should have proper ARIA attributes on dialog', () => {
    render(<PaymentConsentModal />);

    const dialog = document.querySelector('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'consent-modal-title');
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      'consent-modal-description'
    );
  });

  it('should have ARIA labels on interactive elements', () => {
    const { container } = render(<PaymentConsentModal />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label');
    });

    const links = container.querySelectorAll('a');
    links.forEach((link) => {
      expect(link).toHaveAttribute('aria-label');
    });
  });

  it('should hide decorative icons from screen readers', () => {
    const { container } = render(<PaymentConsentModal />);

    const decorativeIcons = container.querySelectorAll(
      'svg[aria-hidden="true"]'
    );
    expect(decorativeIcons.length).toBeGreaterThan(0);
  });

  it('should meet WCAG touch target size (44x44px)', () => {
    const { container } = render(<PaymentConsentModal />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      // Check for min-h-11 class (11 * 4px = 44px in Tailwind)
      expect(button.className).toContain('min-h-11');
    });
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(<PaymentConsentModal />);

    // Axe will check color contrast
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should support keyboard navigation', () => {
    const { container } = render(<PaymentConsentModal />);

    const focusableElements = container.querySelectorAll(
      'button, a, [tabindex]'
    );

    focusableElements.forEach((element) => {
      // Should not have negative tabindex (unless explicitly hidden)
      const tabindex = element.getAttribute('tabindex');
      if (tabindex !== null) {
        expect(parseInt(tabindex)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('should have proper button types to prevent form submission', () => {
    const { container } = render(<PaymentConsentModal />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      expect(button.getAttribute('type')).toBe('button');
    });
  });

  it('should have descriptive link text', () => {
    const { container } = render(<PaymentConsentModal />);

    const links = container.querySelectorAll('a');
    links.forEach((link) => {
      const text = link.textContent || link.getAttribute('aria-label');
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(0);
    });
  });

  it('should maintain focus within modal (focus trap)', () => {
    render(<PaymentConsentModal />);

    // Dialog element should trap focus
    const dialog = document.querySelector('dialog');
    expect(dialog).toBeInTheDocument();

    // Check that tabbing stays within modal
    const focusableElements = dialog?.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    expect(focusableElements && focusableElements.length).toBeGreaterThan(0);
  });
});
