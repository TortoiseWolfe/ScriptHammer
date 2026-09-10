import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import OrderList from './OrderList';
import { buyerOrders } from '../__fixtures__/orders';

expect.extend(toHaveNoViolations);

/**
 * Both states are audited on purpose. The three E2E route sweeps visit `/orders` as the
 * authenticated primary user, who owns no orders — so CI's only look at this component is
 * at its EMPTY state. An axe run on the empty state alone would repeat that blind spot in
 * miniature: the definition list, the badges and the fallback SKU would go unmeasured
 * everywhere.
 */
describe('OrderList Accessibility', () => {
  it('has no violations with orders on the page', async () => {
    const { container } = render(<OrderList orders={buyerOrders} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when the buyer has ordered nothing', async () => {
    const { container } = render(<OrderList orders={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('pairs every amount with its own label, the way a screen reader reads it', () => {
    // A flex row that merely LOOKS like two columns reads as a run-on line. dt -> dd is
    // what makes "Charged $600.00" and "Balance $600.00" distinguishable when both
    // amounts are identical, which on a 50% deposit they always are.
    const { container } = render(<OrderList orders={buyerOrders} />);
    const rowFor = (label: RegExp) => {
      const dt = Array.from(container.querySelectorAll('dt')).find((el) =>
        label.test(el.textContent ?? '')
      );
      return dt?.parentElement?.querySelector('dd')?.textContent ?? null;
    };
    expect(rowFor(/^Charged/)).toBe('$600.00');
    expect(rowFor(/^Balance/)).toBe('$600.00');
  });
});
