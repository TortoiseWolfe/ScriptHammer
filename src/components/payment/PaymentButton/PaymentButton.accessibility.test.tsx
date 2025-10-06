/**
 * PaymentButton Accessibility Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PaymentButton } from './PaymentButton';

expect.extend(toHaveNoViolations);

// Mock hooks
vi.mock('@/hooks/usePaymentButton', () => ({
  usePaymentButton: vi.fn(() => ({
    selectedProvider: null,
    isProcessing: false,
    error: null,
    queuedCount: 0,
    hasConsent: true,
    selectProvider: vi.fn(),
    initiatePayment: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock('@/hooks/usePaymentConsent', () => ({
  usePaymentConsent: vi.fn(() => ({
    showModal: false,
    hasConsent: true,
    consentDate: new Date().toISOString(),
    grantConsent: vi.fn(),
    declineConsent: vi.fn(),
    resetConsent: vi.fn(),
  })),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  formatPaymentAmount: vi.fn(() => '$20.00'),
}));

describe('PaymentButton Accessibility', () => {
  const defaultProps = {
    amount: 2000,
    currency: 'usd' as const,
    type: 'one_time' as const,
    customerEmail: 'test@example.com',
  };

  it('should have no accessibility violations in default state', async () => {
    const { container } = render(<PaymentButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with provider selected', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: 'stripe',
      isProcessing: false,
      error: null,
      queuedCount: 0,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    const { container } = render(<PaymentButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with error displayed', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: null,
      isProcessing: false,
      error: new Error('Test error'),
      queuedCount: 0,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    const { container } = render(<PaymentButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations in processing state', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: 'stripe',
      isProcessing: true,
      error: null,
      queuedCount: 0,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    const { container } = render(<PaymentButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with offline queue notice', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: null,
      isProcessing: false,
      error: null,
      queuedCount: 2,
      hasConsent: true,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    const { container } = render(<PaymentButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with consent warning', async () => {
    const { usePaymentButton } = await import('@/hooks/usePaymentButton');
    vi.mocked(usePaymentButton).mockReturnValue({
      selectedProvider: null,
      isProcessing: false,
      error: null,
      queuedCount: 0,
      hasConsent: false,
      selectProvider: vi.fn(),
      initiatePayment: vi.fn(),
      clearError: vi.fn(),
    });

    const { container } = render(<PaymentButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations in different sizes', async () => {
    const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

    for (const size of sizes) {
      const { container } = render(
        <PaymentButton {...defaultProps} size={size} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it('should have no violations without provider tabs', async () => {
    const { container } = render(
      <PaymentButton {...defaultProps} showProviderTabs={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should meet WCAG touch target size (44x44px minimum)', () => {
    const { container } = render(<PaymentButton {...defaultProps} />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      // Check for min-h-11 class (11 * 4px = 44px in Tailwind)
      expect(button.className).toContain('min-h-11');
    });
  });

  it('should have proper keyboard navigation support', () => {
    const { container } = render(<PaymentButton {...defaultProps} />);

    const interactiveElements = container.querySelectorAll(
      'button, [role="tab"]'
    );
    interactiveElements.forEach((element) => {
      // Should not have negative tabindex
      expect(element.getAttribute('tabindex')).not.toBe('-1');
    });
  });
});
