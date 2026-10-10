/**
 * /checkout must preview the tip the buyer chose, not the SKU's seeded default (#1306).
 *
 * `/checkout?sku=tip-jar&amount=5000` used to say "Total today $15.00" and "Pay $15"
 * while create-order charged $50: the preview read `product.amount` and only the
 * request read `?amount=`. This drives the PAGE through the URL, because the gap was
 * between the summary and the request, not inside either one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { tipJar, discovery } from '@/components/payment/__fixtures__/products';

let search = '';
let productRow: Record<string, unknown> | null = null;

vi.mock('@/lib/supabase/client', () => {
  const builder = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) {
      chain[m] = () => chain;
    }
    chain.maybeSingle = async () => ({ data: productRow, error: null });
    return chain;
  };
  return {
    supabase: {
      from: () => builder(),
      auth: { getSession: async () => ({ data: { session: null } }) },
    },
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/config/payment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/payment')>()),
  featureFlags: {
    stripeEnabled: true,
    paypalEnabled: false,
    cashAppEnabled: false,
    chimeEnabled: false,
  },
}));

vi.mock('@/lib/payments/payment-service', () => ({
  getPaymentStatus: vi.fn(),
}));

vi.mock('@/lib/payments/stripe', () => ({
  createCheckoutSession: vi.fn(),
  handleStripeRedirect: vi.fn(),
}));

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({
    consent: {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    },
  }),
}));

vi.mock('@/hooks/usePaymentConsent', () => ({
  usePaymentConsent: () => ({ hasConsent: true, ready: true }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1', email: 'buyer@example.com' } },
    isLoading: false,
  }),
}));

vi.mock('@/components/payment/PaymentConsentModal', () => ({
  PaymentConsentModal: () => null,
}));

/** Reports the label the page computed; the real form drags in uploads and zod. */
vi.mock('@/components/forms/IntakeForm', () => ({
  default: ({ submitLabel }: { submitLabel?: string }) => (
    <button type="submit">{submitLabel}</button>
  ),
}));

import CheckoutPage from './page';

describe('the checkout preview matches what a variable SKU charges (#1306)', () => {
  beforeEach(() => {
    productRow = tipJar as unknown as Record<string, unknown>;
  });

  it('labels the button with the chosen tip, not the $15 default', async () => {
    search = 'sku=tip-jar&amount=5000';
    render(<CheckoutPage />);
    expect(
      await screen.findByRole('button', { name: 'Pay $50.00' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$15\.00/)).not.toBeInTheDocument();
  });

  it('shows no package price for a tip', async () => {
    search = 'sku=tip-jar&amount=5000';
    render(<CheckoutPage />);
    await screen.findByRole('button', { name: 'Pay $50.00' });
    expect(screen.queryByText(/Package price/)).not.toBeInTheDocument();
  });

  it.each([
    ['no amount', 'sku=tip-jar'],
    ['an amount above the maximum', 'sku=tip-jar&amount=50001'],
    ['an amount below the minimum', 'sku=tip-jar&amount=99'],
    ['a fractional amount', 'sku=tip-jar&amount=1500.5'],
    ['a non-numeric amount', 'sku=tip-jar&amount=abc'],
  ])(
    'asks for an amount instead of the form when given %s',
    async (_l, query) => {
      search = query;
      render(<CheckoutPage />);
      expect(await screen.findByText('Choose an amount')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^Pay / })
      ).not.toBeInTheDocument();
    }
  );

  it('COUNTERWEIGHT: a fixed SKU ignores ?amount= and charges its own price', async () => {
    productRow = discovery as unknown as Record<string, unknown>;
    search = 'sku=svc-discovery&amount=5000';
    render(<CheckoutPage />);
    expect(
      await screen.findByRole('button', { name: 'Pay $250.00' })
    ).toBeInTheDocument();
  });
});
