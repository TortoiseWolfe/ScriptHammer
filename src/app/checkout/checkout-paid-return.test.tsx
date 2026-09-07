/**
 * The SKU must survive the hosted-Stripe return leg (#1092).
 *
 * WHY THIS FILE EXISTS. Per-SKU booking (#1092, #1095, #1100) was built, shipped, deployed,
 * and verified — and never worked for a single paying customer. `/checkout` has two ways of
 * reaching the paid stage:
 *
 *   - INLINE payment, where the catalog effect has already loaded the product from `?sku=`.
 *   - HOSTED Stripe Checkout, which returns to `?session_id=…` with NO `sku` parameter. That
 *     effect returns early (`if (sessionId) return; // the return leg owns the stage`), so
 *     the return leg is the sole author of the stage — and it set `product: null`.
 *
 * `BookingStep` then received `sku={undefined}`, `resolveCalendarUrl` fell through to the
 * general call, and someone who paid $99 for a "90-minute live 1:1 session" was handed the
 * 15-minute link.
 *
 * WHY NOTHING CAUGHT IT. `BookingStep.test.tsx:159` passes `sku: 'prd-office-hours'` and
 * asserts the office-hours URL comes out. That is true and useless: it proves the component
 * honours a SKU it is given, on the one input the page never supplied. The gap was between
 * two correct units, which is where this repo's defects keep living — the same shape as the
 * Cal.com provider whose only test passed an already-bare link (#1100).
 *
 * SO THIS TEST DRIVES THE PAGE, NOT THE COMPONENT, and it drives it through the URL a buyer
 * actually returns to. If it is ever rewritten to render `BookingStep` directly, it has
 * stopped testing the thing that broke.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const ORDER = {
  id: '11111111-1111-4111-8111-111111111111',
  buyer_email: 'buyer@example.com',
  product_id: 'prd-office-hours',
};

const PRODUCT = {
  id: 'prd-office-hours',
  name: 'Office Hours',
  type: 'product',
  amount: 7900,
  amount_mode: 'fixed',
  billing_interval: 'one_time',
  features: ['One focused 40-minute working session'],
  active: true,
};

/** Records every table queried, so a test can prove the products lookup happened at all. */
const queried: string[] = [];
let productRow: Record<string, unknown> | null = PRODUCT;
let orderRow: Record<string, unknown> | null = ORDER;

vi.mock('@/lib/supabase/client', () => {
  const builder = (table: string) => {
    queried.push(table);
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) {
      chain[m] = () => chain;
    }
    chain.maybeSingle = async () => ({
      data: table === 'orders' ? orderRow : productRow,
      error: null,
    });
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      auth: { getSession: async () => ({ data: { session: null } }) },
    },
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('session_id=cs_test_abc123'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  getPaymentStatus: async () => ({ status: 'succeeded' }),
}));

vi.mock('@/lib/payments/stripe', () => ({
  createCheckoutSession: vi.fn(),
  handleStripeRedirect: () => ({
    kind: 'return',
    intentId: '22222222-2222-4222-8222-222222222222',
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

/**
 * BookingStep is stubbed to REPORT its props rather than render a calendar. The assertion
 * is about what the page hands down; rendering the real component would drag in the calendar
 * config and make a passing test depend on environment variables.
 */
vi.mock('@/components/payment/BookingStep', () => ({
  default: ({ sku, productName }: { sku?: string; productName?: string }) => (
    <div
      data-testid="booking-step"
      data-sku={sku ?? '(none)'}
      data-product-name={productName ?? '(none)'}
    />
  ),
}));

import CheckoutPage from './page';

describe('the paid return leg carries the SKU (#1092)', () => {
  beforeEach(() => {
    queried.length = 0;
    productRow = PRODUCT;
    orderRow = ORDER;
  });

  it('hands BookingStep the SKU that was actually purchased', async () => {
    render(<CheckoutPage />);
    const step = await screen.findByTestId('booking-step');
    expect(
      step.getAttribute('data-sku'),
      'BookingStep got no SKU on the hosted-Stripe return leg, so resolveCalendarUrl ' +
        'falls through to the general call and a paying buyer books the free intro call'
    ).toBe('prd-office-hours');
  });

  it('reads the SKU from the ORDER, since the return URL has none', async () => {
    // The load-bearing detail. `?session_id=…` carries no `sku`, so the only source of
    // truth is orders.product_id. If someone "simplifies" this back to reading the URL,
    // this fails while the test above might not.
    render(<CheckoutPage />);
    await screen.findByTestId('booking-step');
    expect(
      queried,
      'the products table was never queried — the SKU cannot have come from the order'
    ).toContain('products');
    expect(queried).toContain('orders');
  });

  it('names the purchased product on the confirmation', async () => {
    render(<CheckoutPage />);
    const step = await screen.findByTestId('booking-step');
    expect(step.getAttribute('data-product-name')).toBe('Office Hours');
  });

  it('still confirms the payment when the product lookup fails', async () => {
    // COUNTERWEIGHT, and it is the more important half. Degrading to the general booking
    // link is bad; showing no confirmation at all to someone whose card was charged is
    // worse. A failed lookup must not become a failed confirmation.
    productRow = null;
    render(<CheckoutPage />);
    const step = await screen.findByTestId('booking-step');
    expect(step.getAttribute('data-sku')).toBe('(none)');
    expect(step).toBeInTheDocument();
  });

  it('ANTI-VACUITY: the harness can produce the failing outcome', async () => {
    // If the mock always yielded a product, every assertion above would pass against a page
    // that hardcoded 'prd-office-hours'. Removing product_id from the order must produce the
    // no-SKU result — proving these tests read the order rather than a constant.
    orderRow = { ...ORDER, product_id: null };
    render(<CheckoutPage />);
    const step = await screen.findByTestId('booking-step');
    expect(step.getAttribute('data-sku')).toBe('(none)');
    await waitFor(() => expect(queried).not.toContain('products'));
  });
});
