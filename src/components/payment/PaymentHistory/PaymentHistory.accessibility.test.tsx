/**
 * PaymentHistory Accessibility Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PaymentHistory } from './PaymentHistory';

expect.extend(toHaveNoViolations);

// Mock payment service
vi.mock('@/lib/payments/payment-service', () => ({
  getPaymentHistory: vi.fn(() => Promise.resolve([])),
  formatPaymentAmount: vi.fn(() => '$20.00'),
}));

describe('PaymentHistory Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<PaymentHistory />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with filters enabled', async () => {
    const { container } = render(<PaymentHistory showFilters={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', async () => {
    const { container } = render(<PaymentHistory />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
