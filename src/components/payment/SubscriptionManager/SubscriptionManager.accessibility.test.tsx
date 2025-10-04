/**
 * SubscriptionManager Accessibility Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SubscriptionManager } from './SubscriptionManager';

expect.extend(toHaveNoViolations);

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/payments/payment-service', () => ({
  formatPaymentAmount: vi.fn(() => '$9.99'),
}));

describe('SubscriptionManager Accessibility', () => {
  const defaultProps = {
    userId: 'user-123',
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(<SubscriptionManager {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', async () => {
    const { container } = render(<SubscriptionManager {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
