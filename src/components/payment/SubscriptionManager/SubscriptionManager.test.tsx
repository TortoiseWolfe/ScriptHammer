/**
 * SubscriptionManager Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SubscriptionManager } from './SubscriptionManager';

// Mutable rows so individual tests can stage grace-period / canceled states.
let mockRows: Record<string, unknown>[] = [];

const activeRow = {
  id: 'sub-1',
  provider_subscription_id: 'stripe_sub_123',
  provider: 'stripe',
  status: 'active',
  plan_amount: 999,
  plan_interval: 'month',
  current_period_start: '2025-01-01T00:00:00Z',
  current_period_end: '2025-02-01T00:00:00Z',
  grace_period_expires: null,
  canceled_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// Mock Supabase client — returns the staged mockRows.
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: mockRows,
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ data: null, error: null })),
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
    realtime: false, // unit tests don't open a live channel
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRows = [{ ...activeRow }];
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

  it('shows a grace-period countdown with days remaining', async () => {
    const inFiveDays = new Date(Date.now() + 5 * 86_400_000)
      .toISOString()
      .split('T')[0];
    mockRows = [
      {
        ...activeRow,
        status: 'grace_period',
        grace_period_expires: inFiveDays,
      },
    ];
    render(<SubscriptionManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/5 days remaining/i)).toBeInTheDocument();
    });
    // The grace badge renders too (status === 'grace_period').
    expect(screen.getAllByText(/Grace Period/i).length).toBeGreaterThan(0);
  });

  it('clamps an expired grace period to 0 days', async () => {
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .split('T')[0];
    mockRows = [
      {
        ...activeRow,
        status: 'grace_period',
        grace_period_expires: yesterday,
      },
    ];
    render(<SubscriptionManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/0 days remaining/i)).toBeInTheDocument();
    });
  });

  it('offers Resume (not Cancel) for a canceled subscription', async () => {
    mockRows = [{ ...activeRow, status: 'canceled' }];
    render(<SubscriptionManager {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /resume subscription/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /cancel subscription/i })
    ).not.toBeInTheDocument();
  });
});
