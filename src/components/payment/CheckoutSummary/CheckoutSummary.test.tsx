import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckoutSummary, {
  formatCents,
  depositPercent,
  previewAmountDue,
  cancellationTerms,
} from './CheckoutSummary';
import { landingPage, discovery, carePlan } from '../__fixtures__/products';

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

/**
 * T034 (#561). `/checkout` promised "Terms are shown before payment" while nothing on the
 * path showed any. These cases pin the content, not the promise —
 * `scripts/__tests__/checkout-shows-the-terms-it-promises.test.js` pins the connection.
 */
describe('the terms a buyer is promised before paying', () => {
  it('shows them on the summary, which is what both checkout branches render', () => {
    render(<CheckoutSummary product={landingPage} amountDueNow={60000} />);
    const terms = screen.getByRole('region', { name: /before you pay/i });
    expect(terms).toBeInTheDocument();
    expect(terms).toHaveTextContent(/full refund/i);
    expect(terms).toHaveTextContent(
      /the price shown here is the price charged/i
    );
  });

  it('links to the full terms with a BARE href, so the basePath is added once', () => {
    // next/link prepends the runtime basePath itself. Routing this through
    // getInternalUrl() would prepend it twice — the trap #159 pinned for /privacy.
    render(<CheckoutSummary product={landingPage} amountDueNow={60000} />);
    const link = screen.getByRole('link', { name: /full terms/i });
    expect(link).toHaveAttribute('href', '/terms');
  });

  it('names the deposit as non-refundable ONLY when there is a deposit', () => {
    // The two SKUs differ by one metadata key, and the sentence is a commitment about
    // money — asserting it on the deposit SKU alone would pass if it rendered always.
    const { unmount } = render(
      <CheckoutSummary product={landingPage} amountDueNow={60000} />
    );
    expect(
      screen.getByRole('region', { name: /before you pay/i })
    ).toHaveTextContent(
      /deposit covering work already carried out is not refundable/i
    );
    unmount();

    render(<CheckoutSummary product={discovery} amountDueNow={25000} />);
    expect(
      screen.getByRole('region', { name: /before you pay/i })
    ).not.toHaveTextContent(/not refundable/i);
  });

  it('tells a subscriber it renews, which the price rows never did', () => {
    // Before this, a monthly plan rendered identically to a one-time build — same card,
    // labelled "Total today", with nothing saying it would happen again next month.
    render(<CheckoutSummary product={carePlan} amountDueNow={9900} />);
    const terms = screen.getByRole('region', { name: /before you pay/i });
    expect(terms).toHaveTextContent(/renews automatically every month/i);
    expect(terms).toHaveTextContent(
      /end of the period you have already paid for/i
    );
  });

  it('promises the site is not torn down WITHOUT promising it stays reachable', () => {
    // The distinction is the whole point of the wording (owner, 2026-09-10): cancelling
    // stops the work and takes nothing down, but uptime then depends on the domain, the
    // hosting account and whether the buyer holds a copy — none of which the seller
    // controls. "Your site stays up" would replace one false assurance with another.
    const lines = cancellationTerms(carePlan).join(' ');
    expect(lines).toMatch(/does not take your site down/i);
    expect(lines).toMatch(/domain/i);
    expect(lines).not.toMatch(/stays (up|online|live)/i);
    expect(lines).not.toMatch(/guarantee/i);
  });

  it('says year for an annual plan rather than hardcoding month', () => {
    expect(cancellationTerms({ ...carePlan, interval: 'year' })[0]).toMatch(
      /every year/
    );
  });

  it('never offers subscription wording for a one-time build, or vice versa', () => {
    // Counterweight: a single always-rendered blob of text would satisfy every case above.
    expect(cancellationTerms(landingPage).join(' ')).not.toMatch(/renew/i);
    expect(cancellationTerms(carePlan).join(' ')).not.toMatch(/work begins/i);
  });
});
