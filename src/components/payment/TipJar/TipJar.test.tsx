import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TipJar, { TIP_MIN_CENTS, TIP_MAX_CENTS } from './TipJar';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const reduced = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduced(),
}));

const amountField = () => screen.getByLabelText(/amount in whole dollars/i);
const give = () => screen.getByRole('button', { name: /send a tip/i });

describe('TipJar', () => {
  beforeEach(() => {
    push.mockClear();
    reduced.mockReturnValue(false);
  });

  it('sends the amount in CENTS, not dollars', () => {
    render(<TipJar />);
    fireEvent.change(amountField(), { target: { value: '15' } });
    fireEvent.click(give());
    // 15 dollars must become 1500 cents. A dollars-for-cents slip here charges
    // a tipper 1/100th of what they chose and reads as a working page.
    expect(push).toHaveBeenCalledWith('/checkout?sku=tip-jar&amount=1500');
  });

  it('refuses a non-integer amount before any navigation', () => {
    render(<TipJar />);
    fireEvent.change(amountField(), { target: { value: '15.5' } });
    fireEvent.click(give());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it.each([
    ['below the floor', String(TIP_MIN_CENTS / 100 - 1)],
    ['above the ceiling', String(TIP_MAX_CENTS / 100 + 1)],
    ['empty', ''],
    ['not a number', 'abc'],
  ])('refuses an amount %s', (_label, value) => {
    render(<TipJar />);
    fireEvent.change(amountField(), { target: { value } });
    fireEvent.click(give());
    expect(push).not.toHaveBeenCalled();
  });

  it('accepts both boundary values', () => {
    render(<TipJar />);
    fireEvent.change(amountField(), {
      target: { value: String(TIP_MIN_CENTS / 100) },
    });
    fireEvent.click(give());
    expect(push).toHaveBeenLastCalledWith(
      `/checkout?sku=tip-jar&amount=${TIP_MIN_CENTS}`
    );
    fireEvent.change(amountField(), {
      target: { value: String(TIP_MAX_CENTS / 100) },
    });
    fireEvent.click(give());
    expect(push).toHaveBeenLastCalledWith(
      `/checkout?sku=tip-jar&amount=${TIP_MAX_CENTS}`
    );
  });

  it('a preset fills the field and then submits that value', () => {
    render(<TipJar />);
    fireEvent.click(screen.getByRole('button', { name: '$50' }));
    expect(amountField()).toHaveValue(50);
    fireEvent.click(give());
    expect(push).toHaveBeenCalledWith('/checkout?sku=tip-jar&amount=5000');
  });

  it('does NOT apply sh-shake when reduced motion is on', () => {
    // The class must never be applied, rather than applied and suppressed by
    // CSS -- the in-app toggle is not a media query and cannot suppress it.
    reduced.mockReturnValue(true);
    render(<TipJar />);
    fireEvent.change(amountField(), { target: { value: '0' } });
    fireEvent.click(give());
    expect(amountField().className).not.toContain('sh-shake');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies sh-shake on rejection when motion is allowed', () => {
    render(<TipJar />);
    fireEvent.change(amountField(), { target: { value: '0' } });
    fireEvent.click(give());
    expect(amountField().className).toContain('sh-shake');
  });

  describe('compact — the variant that actually sits where value lands', () => {
    it('a preset goes STRAIGHT to checkout, no second screen', () => {
      // The whole point of compact: giving is one click at the moment somebody
      // takes the free thing. A navigation to /tip first is the empty room.
      render(<TipJar compact />);
      fireEvent.click(screen.getByRole('button', { name: '$15' }));
      expect(push).toHaveBeenCalledWith('/checkout?sku=tip-jar&amount=1500');
    });

    it('offers all three presets and an escape to /tip for anything else', () => {
      render(<TipJar compact />);
      expect(screen.getByRole('button', { name: '$5' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '$15' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '$50' })).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /another amount/i })
      ).toHaveAttribute('href', '/tip');
    });

    it('has no free-text amount field — that is what /tip is for', () => {
      render(<TipJar compact />);
      expect(screen.queryByLabelText(/amount in whole dollars/i)).toBeNull();
    });

    it('every preset clears the 44px touch target', () => {
      render(<TipJar compact />);
      for (const b of screen.getAllByRole('button')) {
        expect(b.className).toMatch(/min-h-11/);
      }
    });
  });
});

describe('TipJar — GA4 conversion signal (#115 measurement arc)', () => {
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

  it('reports a compact preset, in DOLLARS not cents', () => {
    // cents would report a $5 tip as value 500 and make the jar look like the most
    // valuable product on the site.
    render(<TipJar compact />);
    fireEvent.click(screen.getByRole('button', { name: '$5' }));
    const [, action, params] = evt()!;
    expect(action).toBe('tip_jar_give');
    expect(params.event_category).toBe('Conversion');
    expect(params.value).toBe(5);
    expect(params.tip_cents).toBe(500);
  });

  it('does NOT report a preset in the full jar — that only fills the input', () => {
    // In the full jar a preset is a glance, not a decision; `onGive` is the decision.
    // Counting presets here would inflate conversions with people who changed their mind.
    render(<TipJar />);
    fireEvent.click(screen.getByRole('button', { name: '$15' }));
    expect(evt()).toBeUndefined();
  });

  it('reports when the full jar is actually submitted', () => {
    render(<TipJar />);
    fireEvent.click(screen.getByRole('button', { name: '$15' }));
    fireEvent.click(give());
    expect(evt()![2].value).toBe(15);
  });

  it('does NOT report a rejected amount', () => {
    // An amount outside the bounds never reaches checkout, so it is not a conversion.
    render(<TipJar />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.click(give());
    expect(evt()).toBeUndefined();
  });

  it('CONTROL: no gtag is a silent no-op', () => {
    vi.unstubAllGlobals();
    render(<TipJar compact />);
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: '$5' }))
    ).not.toThrow();
  });
});
