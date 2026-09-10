import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OrderList, { balanceOf, money, STATUS_LABEL } from './OrderList';
import {
  buyerOrders,
  depositOrder,
  paidInFullOrder,
  retiredSkuOrder,
} from '../__fixtures__/orders';

/**
 * These cases carry more weight than usual, and it is worth saying why.
 *
 * Nothing in this repository inserts an `orders` row — not a seed, not a fixture, not an
 * E2E spec (the one that touches the route `page.route`-mocks the REST call). The three
 * sweeps that enumerate `src/app/**\/page.tsx` run as the authenticated primary user, who
 * owns nothing, so they render this component's EMPTY state in three themes and four
 * widths and pass. Every automated gate that appears to cover `/orders` covers a page with
 * no orders on it. Until an E2E fixture writes a real row, these unit cases are the only
 * thing that has ever seen an order card.
 */
describe('OrderList', () => {
  const card = (name: RegExp | string) =>
    screen
      .getAllByTestId('buyer-order')
      .find((el) => within(el).queryByText(name)) as HTMLElement;

  it('renders one card per order, newest first as queried', () => {
    render(<OrderList orders={buyerOrders} />);
    expect(screen.getAllByTestId('buyer-order')).toHaveLength(4);
  });

  it('labels the money "Charged" and never "Total"', () => {
    // amount_charged on the two deposit SKUs is HALF the package price, and no column
    // persists the balance. Calling it a total would be a true number under a false word.
    render(<OrderList orders={[depositOrder]} />);
    expect(screen.getByText('Charged')).toBeInTheDocument();
    expect(screen.queryByText(/^Total/)).not.toBeInTheDocument();
  });

  it('names the outstanding balance on a deposit order', () => {
    // A 50% split makes "Charged" and "Balance" BOTH $600.00, so asserting on the text
    // alone is ambiguous and passes for the wrong reason — the identical trap already
    // documented in CheckoutSummary.test.tsx. Walk dt -> dd, which is what a screen
    // reader does, and which is the whole reason these are a definition list.
    const { container } = render(<OrderList orders={[depositOrder]} />);
    const rowFor = (label: RegExp) => {
      const dt = Array.from(container.querySelectorAll('dt')).find((el) =>
        label.test(el.textContent ?? '')
      );
      return dt?.parentElement?.querySelector('dd')?.textContent ?? null;
    };
    expect(rowFor(/^Charged/)).toBe('$600.00');
    expect(rowFor(/^Balance/)).toBe('$600.00');
    expect(
      within(card('Landing Page')).getByText(/invoiced separately/i)
    ).toBeInTheDocument();
  });

  it('shows no balance line when the order is paid in full', () => {
    // Counterweight to the case above: a balance row rendered unconditionally would
    // satisfy it while telling every buyer they still owe something.
    render(<OrderList orders={[paidInFullOrder]} />);
    expect(screen.queryByText(/invoiced separately/i)).not.toBeInTheDocument();
  });

  it('falls back to the SKU when the catalog row is unreadable', () => {
    // `products` SELECT is `USING (active = true)`, so an order for a retired plan joins
    // to nothing. A blank heading would look like a rendering bug to the person who paid.
    render(<OrderList orders={[retiredSkuOrder]} />);
    expect(screen.getByText('svc-care')).toBeInTheDocument();
  });

  it('says nothing about the balance it cannot know', () => {
    // With no catalog row there is no price to subtract from. Silence is the only honest
    // output — `balanceOf` returns null rather than 0 precisely so this cannot render.
    render(<OrderList orders={[retiredSkuOrder]} />);
    expect(screen.queryByText(/invoiced separately/i)).not.toBeInTheDocument();
    expect(balanceOf(retiredSkuOrder)).toBeNull();
  });

  it('translates every stage into something a buyer can act on', () => {
    render(<OrderList orders={buyerOrders} />);
    expect(screen.getByText('Payment not confirmed yet')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('gives a buyer with no orders a sentence, not an empty box', () => {
    render(<OrderList orders={[]} />);
    expect(
      screen.getByText(/have not placed an order yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('buyer-order')).not.toBeInTheDocument();
  });

  it('covers every status the database can store', () => {
    // The DB CHECK and the TS union are kept in step at migration:408-409. If a seventh
    // value is ever added, this fails here rather than rendering a bare enum to a buyer.
    expect(Object.keys(STATUS_LABEL).sort()).toEqual([
      'canceled',
      'delivered',
      'fulfilling',
      'paid',
      'pending',
      'refunded',
    ]);
  });

  it('renders an em dash rather than $0.00 for a missing amount', () => {
    expect(money(null)).toBe('—');
    expect(money(0)).toBe('$0.00');
  });

  it('shows an unknown status verbatim rather than swallowing it', () => {
    // If the DB grows a seventh stage before this build knows the word for it, the buyer
    // should see the raw value — not an empty badge that reads as "no information".
    render(
      <OrderList orders={[{ ...paidInFullOrder, status: 'awaiting_parts' }]} />
    );
    expect(screen.getByText('awaiting_parts')).toBeInTheDocument();
  });
});
