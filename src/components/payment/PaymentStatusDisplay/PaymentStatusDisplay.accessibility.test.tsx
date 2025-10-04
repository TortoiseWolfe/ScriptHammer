/**
 * PaymentStatusDisplay Accessibility Tests
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';
import type { PaymentResult } from '@/types/payment';

expect.extend(toHaveNoViolations);

describe('PaymentStatusDisplay Accessibility', () => {
  const mockSuccessResult: PaymentResult = {
    id: 'result-1',
    intent_id: 'intent-1',
    template_user_id: 'user-1',
    provider: 'stripe',
    transaction_id: 'txn_123',
    status: 'succeeded',
    charged_amount: 2000,
    charged_currency: 'usd',
    provider_fee: 58,
    webhook_verified: true,
    webhook_verified_at: '2025-01-01T00:00:00Z',
    redirect_verified: false,
    redirect_verified_at: null,
    verification_method: 'webhook',
    failure_reason: null,
    error_code: null,
    error_message: null,
    metadata: {},
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  it('should have no violations in success state', async () => {
    const { container } = render(
      <PaymentStatusDisplay result={mockSuccessResult} loading={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations in loading state', async () => {
    const { container } = render(<PaymentStatusDisplay loading={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations in error state', async () => {
    const { container } = render(
      <PaymentStatusDisplay
        loading={false}
        error={new Error('Payment failed')}
        onRetry={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', async () => {
    const { container } = render(
      <PaymentStatusDisplay result={mockSuccessResult} loading={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
