import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BuyLink, { priceToUsd } from './BuyLink';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...rest
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...rest}>{children}</a>
  ),
}));

describe('priceToUsd', () => {
  it('reads the display price as whole dollars', () => {
    expect(priceToUsd('$2,500')).toBe(2500);
    expect(priceToUsd('$39')).toBe(39);
    expect(priceToUsd('$149')).toBe(149);
  });

  it('returns undefined, NOT zero, for prices that are not numbers', () => {
    // Zero is a real price to GA and would drag the average of every conversion
    // report toward nothing. Absent is the honest answer for these.
    for (const p of ['Free', "Let's talk", 'Contact us', '']) {
      expect(priceToUsd(p)).toBeUndefined();
    }
  });

  it('CONTROL: it is actually parsing, not returning a constant', () => {
    expect(priceToUsd('$39')).not.toBe(priceToUsd('$2,500'));
  });
});

describe('BuyLink', () => {
  let gtag: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  const evt = () => gtag.mock.calls.find((c) => c[0] === 'event');

  it('reports the SKU and the price on click', () => {
    render(
      <BuyLink sku="svc-site" href="/checkout?sku=svc-site" priceUsd={3500}>
        Select
      </BuyLink>
    );
    fireEvent.click(screen.getByText('Select'));
    const [, action, params] = evt()!;
    expect(action).toBe('pricing_cta_click');
    expect(params.event_category).toBe('Conversion');
    expect(params.event_label).toBe('svc-site');
    expect(params.value).toBe(3500);
  });

  it('still reports when there is no price', () => {
    // A "Let's talk" CTA is a conversion signal even without a number attached.
    render(
      <BuyLink sku="svc-discovery" href="/checkout">
        Book
      </BuyLink>
    );
    fireEvent.click(screen.getByText('Book'));
    expect(evt()![2].event_label).toBe('svc-discovery');
    expect(evt()![2].value).toBeUndefined();
  });

  it('marks an external CTA, and renders a plain anchor for it', () => {
    // Link would prefetch a route that does not exist.
    render(
      <BuyLink sku="prd-forge" href="https://github.com/x" external>
        GitHub
      </BuyLink>
    );
    const a = screen.getByText('GitHub');
    expect(a.getAttribute('target')).toBe('_blank');
    fireEvent.click(a);
    expect(evt()![2].outbound).toBe(true);
  });

  it('CONTROL: no gtag is a silent no-op, not a crash', () => {
    // SDK presence is the consent gate; without analytics consent the script never loads.
    vi.unstubAllGlobals();
    render(
      <BuyLink sku="svc-site" href="/checkout">
        Select
      </BuyLink>
    );
    expect(() => fireEvent.click(screen.getByText('Select'))).not.toThrow();
  });
});
