import { test, expect } from '@playwright/test';

/**
 * The order card must actually RENDER somewhere a real browser measures (#1157).
 *
 * WHY THIS EXISTS AS ITS OWN SPEC. `OrderList` is what `/orders` shows a buyer, and until this
 * spec nothing in CI had ever rendered it with an order in it. The chain, each link real:
 * nothing in this repository writes an `orders` row — no seed, no fixture, no spec; the three
 * route sweeps run as the authenticated PRIMARY test user, who owns none; so they render the
 * EMPTY state in three themes and at four widths, and pass. pa11y's URL list is five hand-written
 * entries. The one payment spec that touches the orders REST route mocks it. Vitest excludes
 * `**\/app\/**\/page.tsx` from coverage. Every gate that looked like coverage measured a page
 * with no orders on it, and the first real render would have been a paying customer's screen.
 *
 * WHY IT ASSERTS ON /payment-demo RATHER THAN /orders. Seeding a real row was the obvious fix and
 * is the wrong one. `orders.buyer_user_id` carries no `ON DELETE`, `deleteTestUser` does not know
 * the table exists, and only `service_role` holds a DELETE policy — so a seeded row makes its
 * buyer permanently undeletable, which is the #338/#341 corruption shape on any stack that is not
 * thrown away. And a row is written server-side while the page reads whatever
 * `NEXT_PUBLIC_SUPABASE_URL` was baked at BUILD time; nothing compares the two, so a guard could
 * report "local, safe" while the browser read somewhere else entirely and the sweep measured an
 * empty page anyway. The demo page needs no database, no service-role key and no cleanup.
 *
 * WHAT THIS BUYS. `/payment-demo` is on all three sweeps (its horizontal-scroll quarantine was
 * emptied in #511, so it is simply required to pass), so once the card renders there it is
 * measured for AAA contrast in three themes, for landmarks, and for overflow at 320/375/390/428px
 * — in BOTH lanes, because the fixtures are static.
 *
 * WHAT IT DOES NOT COVER, said plainly: `/orders` fetching real rows through RLS. That path is
 * still exercised only by unit tests. #1157 stays open for it.
 */

test.describe('the order card is rendered somewhere a browser can see it', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment-demo');
  });

  test('renders every example order, ungated by consent', async ({ page }) => {
    // The section above this one on the demo page is gated on `!showConsent && user?.id`, and
    // the sweeps grant no consent — so a gated example would render for humans and for nothing
    // else. If this count is 0, the section has been moved behind a gate and every contrast,
    // landmark and overflow measurement of this card has silently stopped.
    const cards = page.getByTestId('buyer-order');
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toBeVisible();
  });

  test('shows what was charged and what is still owed, as separate rows', async ({
    page,
  }) => {
    // A 50% deposit makes both amounts $600.00, so this walks the definition list rather than
    // matching text — the same reason the unit tests do.
    const deposit = page
      .getByTestId('buyer-order')
      .filter({ hasText: 'Landing Page' })
      .first();
    await expect(deposit.getByText('Charged')).toBeVisible();
    await expect(deposit.getByText(/invoiced separately/i)).toBeVisible();
  });

  test('falls back to the SKU when the catalog row is unreadable', async ({
    page,
  }) => {
    // `products` SELECT is `USING (active = true)`, so an order for a retired plan joins to
    // nothing. A blank heading would look like a rendering fault to the person who paid.
    await expect(page.getByText('svc-care')).toBeVisible();
  });

  test('is marked as an example, so nobody reads it as their own order', async ({
    page,
  }) => {
    // The page is behind ProtectedRoute and shows the viewer's real payment history further up.
    // Four invented orders beside that, unlabelled, would be worse than showing nothing.
    await expect(
      page.getByText(/are examples, not your orders/i)
    ).toBeVisible();
  });
});
