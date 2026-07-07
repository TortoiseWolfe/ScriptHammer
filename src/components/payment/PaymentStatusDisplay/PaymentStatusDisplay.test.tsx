/**
 * PaymentStatusDisplay Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentStatusDisplay } from './PaymentStatusDisplay';
import type { PaymentResult } from '@/types/payment';
import { usePaymentRealtime } from '@/hooks/usePaymentRealtime';

// Mock hooks and services
const mockRetryFailedPayment = vi.fn();

vi.mock('@/hooks/usePaymentRealtime');

vi.mock('@/hooks/usePaymentRetryStatus', () => ({
  usePaymentRetryStatus: vi.fn(() => ({
    loading: false,
    retryCount: 0,
    maxRetries: 3,
    canRetry: true,
    disabledReason: null,
    coolingMsRemaining: 0,
  })),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  retryFailedPayment: (...args: unknown[]) => mockRetryFailedPayment(...args),
  formatPaymentAmount: vi.fn((amount: number, currency: string) => {
    const formatted = (amount / 100).toFixed(2);
    const symbols: Record<string, string> = {
      usd: '$',
      eur: '€',
      gbp: '£',
    };
    return `${symbols[currency] || '$'}${formatted}`;
  }),
  // The hook reads these constants at module load. Keep in sync with
  // src/lib/payments/payment-service.ts.
  RETRY_LIMIT: 3,
  COOLING_PERIOD_MS: 30_000,
  PaymentRetryLimitError: class PaymentRetryLimitError extends Error {
    constructor() {
      super('Limit reached');
      this.name = 'PaymentRetryLimitError';
    }
  },
  PaymentRetryCoolingError: class PaymentRetryCoolingError extends Error {
    waitMs = 0;
    constructor() {
      super('Cooling');
      this.name = 'PaymentRetryCoolingError';
    }
  },
  PaymentRetryExpiredError: class PaymentRetryExpiredError extends Error {
    constructor() {
      super('Expired');
      this.name = 'PaymentRetryExpiredError';
    }
  },
}));

const createMockResult = (status: PaymentResult['status']): PaymentResult => ({
  id: '123',
  intent_id: '456',
  provider: 'stripe',
  transaction_id: 'tx_123',
  status,
  charged_amount: 2000,
  charged_currency: 'usd',
  provider_fee: 58,
  webhook_verified: true,
  verification_method: 'webhook',
  error_code: null,
  error_message: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
});

describe('PaymentStatusDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton while loading', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: null,
      loading: true,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading payment status...')).toBeInTheDocument();
  });

  it('renders error alert when error exists', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: null,
      loading: false,
      error: new Error('Test error'),
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Test error');
  });

  it('renders no result message when result is null', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: null,
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'No payment result found'
    );
  });

  it('renders successful payment status', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Successful')).toBeInTheDocument();
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument();
  });

  it('renders failed payment status with retry button', async () => {
    // Mock is already set up at top level
    const failedResult = createMockResult('failed');
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: failedResult,
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders pending payment status', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('pending'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Pending')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('renders refunded payment status', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('refunded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
    expect(screen.getByText('REFUNDED')).toBeInTheDocument();
  });

  it('displays payment details when showDetails is true', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Amount:')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('Provider:')).toBeInTheDocument();
    expect(screen.getByText('stripe')).toBeInTheDocument(); // lowercase with capitalize CSS class
  });

  it('hides payment details when showDetails is false', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(
      <PaymentStatusDisplay paymentResultId="test-id" showDetails={false} />
    );

    expect(screen.queryByText('Amount:')).not.toBeInTheDocument();
    expect(screen.queryByText('Provider:')).not.toBeInTheDocument();
  });

  it('calls onRetrySuccess when retry succeeds', async () => {
    const user = userEvent.setup();
    const onRetrySuccess = vi.fn();
    // Mock is already set up at top level

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    mockRetryFailedPayment.mockResolvedValue({ id: 'new-intent-123' });

    render(
      <PaymentStatusDisplay
        paymentResultId="test-id"
        onRetrySuccess={onRetrySuccess}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(onRetrySuccess).toHaveBeenCalledWith('new-intent-123');
    });
  });

  it('calls onRetryError when retry fails', async () => {
    const user = userEvent.setup();
    const onRetryError = vi.fn();
    // Mock is already set up at top level

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    const testError = new Error('Retry failed');
    mockRetryFailedPayment.mockRejectedValue(testError);

    render(
      <PaymentStatusDisplay
        paymentResultId="test-id"
        onRetryError={onRetryError}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(onRetryError).toHaveBeenCalledWith(testError);
    });
  });

  it('disables retry button while retrying', async () => {
    const user = userEvent.setup();
    // Mock is already set up at top level

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('failed'),
      loading: false,
      error: null,
    });

    mockRetryFailedPayment.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ id: '123' }), 100))
    );

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    expect(retryButton).toBeDisabled();
  });

  it('displays webhook verified badge when verified', () => {
    // Mock is already set up at top level
    const result = createMockResult('succeeded');
    result.webhook_verified = true;

    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: result,
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" showDetails />);

    expect(screen.getByText('Webhook Verified')).toBeInTheDocument();
  });

  it('does not show retry button for non-failed payments', () => {
    // Mock is already set up at top level
    vi.mocked(usePaymentRealtime).mockReturnValue({
      paymentResult: createMockResult('succeeded'),
      loading: false,
      error: null,
    });

    render(<PaymentStatusDisplay paymentResultId="test-id" />);

    expect(
      screen.queryByRole('button', { name: /retry/i })
    ).not.toBeInTheDocument();
  });

  describe('B1 — categorized error UI (#43)', () => {
    it('renders the categorized userMessage instead of raw provider text (NFR-001)', () => {
      const failed = createMockResult('failed');
      failed.error_code = 'card_declined';
      failed.error_message = 'PG ERROR 23505 some/internal/path';
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      expect(screen.getByText(/your card was declined/i)).toBeInTheDocument();
      expect(screen.queryByText(/PG ERROR 23505/)).not.toBeInTheDocument();
    });

    it('shows transaction reference for support inquiries (FR-004)', () => {
      const failed = createMockResult('failed');
      failed.error_code = 'card_declined';
      failed.transaction_id = 'pi_abc_xyz_42';
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      // Reference shows in both the details panel and the new error block;
      // any rendering of it satisfies FR-004.
      expect(screen.getAllByText(/pi_abc_xyz_42/).length).toBeGreaterThan(0);
    });

    it('hides retry and shows support link for non-recoverable errors (FR-019 lite)', () => {
      const failed = createMockResult('failed');
      failed.error_code = 'expired_card'; // not recoverable
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      expect(
        screen.queryByRole('button', { name: /retry/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /contact support/i })
      ).toBeInTheDocument();
    });

    it('renders the attempt counter "Attempt N of M" (FR-008)', async () => {
      const failed = createMockResult('failed');
      failed.error_code = 'card_declined';
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
      const { usePaymentRetryStatus } = await import(
        '@/hooks/usePaymentRetryStatus'
      );
      vi.mocked(usePaymentRetryStatus).mockReturnValue({
        loading: false,
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        disabledReason: null,
        coolingMsRemaining: 0,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      expect(screen.getByText(/Attempt 2 of 3/)).toBeInTheDocument();
    });

    it('disables button + shows countdown while cooling (FR-010)', async () => {
      const failed = createMockResult('failed');
      failed.error_code = 'card_declined';
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
      const { usePaymentRetryStatus } = await import(
        '@/hooks/usePaymentRetryStatus'
      );
      vi.mocked(usePaymentRetryStatus).mockReturnValue({
        loading: false,
        retryCount: 0,
        maxRetries: 3,
        canRetry: false,
        disabledReason: 'cooling',
        coolingMsRemaining: 23_400,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      const btn = screen.getByRole('button', { name: /retry available in/i });
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent(/Try again in 24s/);
    });
  });

  describe('US3+US4 — switch provider + recovery disclosure (#43)', () => {
    // Stub SwitchProviderPanel to a sentinel so we can assert wiring without
    // re-mounting the whole sub-tree (it has its own dedicated tests). The
    // "fire switch success" button lets tests drive onSwitchSuccess so the
    // parent's navigation (window.location.href) is exercised (#159).
    vi.mock('@/components/payment/SwitchProviderPanel', () => ({
      SwitchProviderPanel: (props: Record<string, unknown>) => (
        <div data-testid="switch-provider-panel">
          switch panel for {String(props.parentIntentId)}
          <button
            type="button"
            data-testid="fire-switch-success"
            onClick={() =>
              (props.onSwitchSuccess as (id: string) => void)?.(
                'new-intent-999'
              )
            }
          >
            fire switch success
          </button>
        </div>
      ),
    }));

    function setupFailedRecoverable() {
      const failed = createMockResult('failed');
      failed.error_code = 'card_declined';
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
    }

    it('renders the "Use a different payment method" button on recoverable failures', () => {
      setupFailedRecoverable();
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      expect(
        screen.getByRole('button', { name: /use a different payment method/i })
      ).toBeInTheDocument();
    });

    it('clicking the switch button toggles the SwitchProviderPanel', async () => {
      const user = userEvent.setup();
      setupFailedRecoverable();
      render(<PaymentStatusDisplay paymentResultId="test-id" />);

      // Closed initially
      expect(
        screen.queryByTestId('switch-provider-panel')
      ).not.toBeInTheDocument();

      const switchBtn = screen.getByRole('button', {
        name: /use a different payment method/i,
      });
      await user.click(switchBtn);

      // Panel mounts with parent intent id wired through
      expect(screen.getByTestId('switch-provider-panel')).toBeInTheDocument();
      expect(screen.getByTestId('switch-provider-panel')).toHaveTextContent(
        '456' // intent_id from createMockResult
      );

      // Clicking again closes
      await user.click(
        screen.getByRole('button', {
          name: /^cancel$/i,
        })
      );
      expect(
        screen.queryByTestId('switch-provider-panel')
      ).not.toBeInTheDocument();
    });

    it('does not render the switch button for non-recoverable errors', () => {
      const failed = createMockResult('failed');
      failed.error_code = 'expired_card'; // not recoverable
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      expect(
        screen.queryByRole('button', {
          name: /use a different payment method/i,
        })
      ).not.toBeInTheDocument();
    });

    it('hides the recovery disclosure at retry_count=0', async () => {
      setupFailedRecoverable();
      const { usePaymentRetryStatus } = await import(
        '@/hooks/usePaymentRetryStatus'
      );
      vi.mocked(usePaymentRetryStatus).mockReturnValue({
        loading: false,
        retryCount: 0,
        maxRetries: 3,
        canRetry: true,
        disabledReason: null,
        coolingMsRemaining: 0,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      expect(screen.queryByText(/need more help/i)).not.toBeInTheDocument();
    });

    it('renders collapsed recovery disclosure at retry_count=1', async () => {
      setupFailedRecoverable();
      const { usePaymentRetryStatus } = await import(
        '@/hooks/usePaymentRetryStatus'
      );
      vi.mocked(usePaymentRetryStatus).mockReturnValue({
        loading: false,
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        disabledReason: null,
        coolingMsRemaining: 0,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      const summary = screen.getByText(/need more help/i);
      // <details> without `open` attribute starts collapsed
      const details = summary.closest('details');
      expect(details).not.toHaveAttribute('open');
    });

    it('renders expanded recovery list at retry_count=2 (FR-016/017)', async () => {
      setupFailedRecoverable();
      const { usePaymentRetryStatus } = await import(
        '@/hooks/usePaymentRetryStatus'
      );
      vi.mocked(usePaymentRetryStatus).mockReturnValue({
        loading: false,
        retryCount: 2,
        maxRetries: 3,
        canRetry: true,
        disabledReason: null,
        coolingMsRemaining: 0,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      const summary = screen.getByText(/need more help/i);
      const details = summary.closest('details');
      expect(details).toHaveAttribute('open');
      // All three steps in priority order: retry → switch method → support.
      // "use a different payment method" appears as both a button label and a
      // recovery-list step, so assert that BOTH elements exist.
      expect(
        screen.getByText(/try again — payment failures/i)
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/use a different payment method/i).length
      ).toBeGreaterThanOrEqual(2);
      expect(
        screen.getByRole('link', { name: /contact support/i })
      ).toBeInTheDocument();
    });

    it('emphasizes support contact when retry cap is reached (FR-019)', async () => {
      setupFailedRecoverable();
      const { usePaymentRetryStatus } = await import(
        '@/hooks/usePaymentRetryStatus'
      );
      vi.mocked(usePaymentRetryStatus).mockReturnValue({
        loading: false,
        retryCount: 3,
        maxRetries: 3,
        canRetry: false,
        disabledReason: 'limit',
        coolingMsRemaining: 0,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      // Retry step is struck through; support link is bold
      const retryStep = screen.getByText(/try again — payment failures/i);
      expect(retryStep).toHaveClass('line-through');
    });
  });

  describe('basePath-aware navigation (issue #159)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Vitest doesn't load .env.local, but Docker injects .env into the
      // container's process.env — so set the base path explicitly per case
      // rather than relying on the ambient value.
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    function setupRecoverable() {
      const failed = createMockResult('failed');
      failed.error_code = 'card_declined';
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
    }

    /** jsdom location stub that records href assignments instead of navigating. */
    function stubLocation(): { href: string } {
      const loc = { href: '' } as { href: string };
      Object.defineProperty(window, 'location', {
        value: loc,
        writable: true,
        configurable: true,
      });
      return loc;
    }

    async function openSwitchPanelAndFire() {
      const user = userEvent.setup();
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      await user.click(
        screen.getByRole('button', {
          name: /use a different payment method/i,
        })
      );
      await user.click(screen.getByTestId('fire-switch-success'));
    }

    it('prefixes the retry-success navigation with the base path', async () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/ScriptHammer';
      setupRecoverable();
      const loc = stubLocation();
      await openSwitchPanelAndFire();
      expect(loc.href).toBe('/ScriptHammer/payment-result?id=new-intent-999');
    });

    it('navigates to the unprefixed path when no base path is set', async () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      setupRecoverable();
      const loc = stubLocation();
      await openSwitchPanelAndFire();
      expect(loc.href).toBe('/payment-result?id=new-intent-999');
    });

    it('routes the support link through next/link so it inherits the base path', () => {
      const failed = createMockResult('failed');
      failed.error_code = 'expired_card'; // non-recoverable → button-style link
      vi.mocked(usePaymentRealtime).mockReturnValue({
        paymentResult: failed,
        loading: false,
        error: null,
      });
      render(<PaymentStatusDisplay paymentResultId="test-id" />);
      const link = screen.getByRole('link', { name: /contact support/i });
      // next/link renders an <a href="/contact">; it prepends the runtime
      // basePath (__NEXT_ROUTER_BASEPATH) in the real app, which jsdom doesn't
      // populate — so we assert the anchor points at the app-relative route.
      // The prefixed form is pinned end-to-end by the basePath E2E project (#157).
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/contact');
    });
  });
});
