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
});
