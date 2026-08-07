import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckoutSummary, {
  formatCents,
  depositPercent,
  previewAmountDue,
} from './CheckoutSummary';
import { landingPage, discovery } from '../__fixtures__/products';

describe('CheckoutSummary', () => {
  it('shows a deposit split, pairing each amount with its own label', () => {
    // A 50% split of $1,200 makes "balance" and "due today" BOTH $600, so
    // asserting on the text alone is ambiguous and passes for the wrong reason.
    // Walk dt -> dd instead, which is also what a screen reader does.
    const { container } = render(
      <CheckoutSummary product={landingPage} amountDueNow={60000} />
    );
    const rowFor = (label: RegExp) => {
      const dt = Array.from(container.querySelectorAll('dt')).find((el) =>
        label.test(el.textContent ?? '')
      );
      return dt?.parentElement?.querySelector('dd')?.textContent ?? null;
    };
    expect(rowFor(/Package price/)).toBe('$1,200.00');
    expect(rowFor(/Balance on delivery/)).toBe('$600.00');
    expect(rowFor(/Deposit due today/)).toBe('$600.00');
  });

  it('says "Total today" when nothing is deferred', () => {
    render(<CheckoutSummary product={discovery} amountDueNow={25000} />);
    expect(screen.getByText(/Total today/)).toBeInTheDocument();
    expect(screen.queryByText(/Balance on delivery/)).not.toBeInTheDocument();
  });

  it('renders a labelled loading state rather than an empty box', () => {
    render(<CheckoutSummary product={null} amountDueNow={null} />);
    expect(screen.getByText(/Loading your selection/)).toBeInTheDocument();
  });

  it('prefers the server amount over its own preview', () => {
    // The server is authoritative. If the two ever disagree, showing the
    // preview would tell the buyer a number they will not be charged.
    render(<CheckoutSummary product={landingPage} amountDueNow={999} />);
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });
});

describe('preview mirrors the server exactly', () => {
  it('rounds DOWN, never up', () => {
    const odd = { ...landingPage, amount: 12345 };
    expect(previewAmountDue(odd)).toBe(6172); // not 6173
  });

  it('bills in full when a deposit would fall under the $1 floor', () => {
    expect(previewAmountDue({ ...landingPage, amount: 150 })).toBe(150);
  });

  it.each([
    ['missing', {}],
    ['zero', { deposit_pct: 0 }],
    ['100', { deposit_pct: 100 }],
    ['fractional', { deposit_pct: 33.3 }],
    ['a string', { deposit_pct: '50' }],
  ])('treats %s deposit_pct as no deposit', (_l, metadata) => {
    expect(depositPercent({ ...landingPage, metadata })).toBeNull();
  });

  it('formats cents as currency', () => {
    expect(formatCents(120000)).toBe('$1,200.00');
    expect(formatCents(0)).toBe('$0.00');
  });
});
