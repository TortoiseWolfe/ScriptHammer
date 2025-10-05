/**
 * SubscriptionManager Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SubscriptionManager } from './SubscriptionManager';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              {
                id: 'sub-1',
                provider_subscription_id: 'stripe_sub_123',
                provider: 'stripe',
                status: 'active',
                amount: 999,
                currency: 'usd',
                interval: 'month',
                current_period_start: '2025-01-01T00:00:00Z',
                current_period_end: '2025-02-01T00:00:00Z',
                cancel_at_period_end: false,
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
              },
            ],
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/payments/payment-service', () => ({
  formatPaymentAmount: vi.fn(() => '$9.99'),
}));

describe('SubscriptionManager', () => {
  const defaultProps = {
    userId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<SubscriptionManager {...defaultProps} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render subscriptions after loading', async () => {
    render(<SubscriptionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/subscription/i)).toBeInTheDocument();
    });
  });

  it('should display subscription status', async () => {
    render(<SubscriptionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });
  });

  it('should apply custom className', () => {
    const { container } = render(
      <SubscriptionManager {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
