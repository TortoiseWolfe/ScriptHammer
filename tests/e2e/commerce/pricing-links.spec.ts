import { test, expect } from '@playwright/test';

/**
 * Every buy button on /pricing must lead somewhere you can actually buy.
 *
 * WHY THIS EXISTS. Reported from production 2026-08-07: three of the eight
 * checkout links on /pricing dead-ended on "That package is not available" —
 * `svc-care`, `svc-care-pro` and `prd-foundry`. That was every subscription
 * product on the page. Two were found by the owner clicking them; the third had
 * simply never been clicked.
 *
 * The cause was a split brain. `src/app/pricing/page.tsx` is a hand-maintained
 * literal array (deliberately — the page is a static export and must not fail to
 * build when Supabase is paused), while `/checkout` resolves the SKU against the
 * `products` table and refuses any row with `active = false`. Nothing connected
 * the two, so a product could be deactivated in the database and go on being
 * advertised with a working-looking button indefinitely.
 *
 * This is deliberately a BLACK-BOX check. It needs no database credentials and
 * knows nothing about `active` flags, plan ids, or the literal array — it clicks
 * what a customer would click and asserts they do not hit a wall. That means it
 * also catches causes nobody has thought of yet: a deleted row, a renamed SKU, a
 * typo'd href, a catalog fetch that silently returns nothing.
 */

/** The copy /checkout renders when it cannot resolve a SKU. */
const DEAD_END = /That package is not available/i;

/**
 * Coverage floor. Without it this spec passes perfectly when the pricing grid
 * fails to render at all — zero links, zero failures, green check. #396 is the
 * standing lesson here: a drop in the MEASURED count means controls stopped
 * being looked at, not that they got better. Raise this when adding packages;
 * never lower it to make a run pass.
 */
const MIN_CHECKOUT_LINKS = 5;

test.describe('pricing → checkout links', () => {
  test('every advertised package resolves to a real one', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Two attribute filters rather than one substring. The app sets
    // `trailingSlash`, so hrefs render as `/checkout/?sku=…`, and under the
    // basePath build they are `/ScriptHammer/checkout/?sku=…`. A literal
    // `a[href*="/checkout?sku="]` matches NEITHER — it found 0 links on the first
    // run, and only the coverage floor below turned that into a failure instead
    // of a green vacuous pass.
    const skus = await page
      .locator('a[href*="/checkout"][href*="sku="]')
      .evaluateAll((els) =>
        els.map((el) => {
          const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
          const m = href.match(/[?&]sku=([^&]+)/);
          return m ? decodeURIComponent(m[1]) : '';
        })
      );

    const unique = [...new Set(skus.filter(Boolean))];
    expect(
      unique.length,
      `Only ${unique.length} checkout links found on /pricing. Either the grid did ` +
        `not render, or the selector stopped matching — both make this spec vacuous.`
    ).toBeGreaterThanOrEqual(MIN_CHECKOUT_LINKS);

    const dead: string[] = [];
    for (const sku of unique) {
      // Trailing slash matches the app's `trailingSlash` setting; without it every
      // navigation eats a redirect.
      await page.goto(`/checkout/?sku=${encodeURIComponent(sku)}`);
      // The catalog is fetched client-side, so the dead-end copy and the order
      // summary both arrive after hydration. Wait for one of them rather than
      // sampling immediately, or a slow fetch reads as a pass.
      await page
        .locator('main')
        .filter({ hasText: /Order summary|That package is not available/i })
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {
          /* fall through to the assertion below, which reports the SKU */
        });

      const body = (await page.locator('main').innerText()) ?? '';
      if (DEAD_END.test(body)) dead.push(sku);
    }

    expect(
      dead,
      `These SKUs are advertised on /pricing but /checkout refuses them: ` +
        `${dead.join(', ')}. Either activate the product (a recurring SKU also ` +
        `needs a stripe_price_id or paypal_plan_id — see ` +
        `products_recurring_provider_check) or mark it comingSoon in ` +
        `src/app/pricing/page.tsx so it stops being advertised.`
    ).toEqual([]);
  });

  test('a package that cannot be bought offers no way to try', async ({
    page,
  }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    const soon = page.locator('[data-testid="coming-soon"]');
    const count = await soon.count();

    // Not asserted to be > 0: when the subscriptions finally have provider plans
    // this legitimately drops to zero, and this spec should keep passing rather
    // than demand that something stay broken.
    for (let i = 0; i < count; i++) {
      const el = soon.nth(i);
      await expect(el).toBeVisible();
      // The whole point: no anchor, no button, nothing clickable.
      expect(
        await el.evaluate((n) => n.closest('a') !== null || n.tagName === 'A')
      ).toBe(false);
      expect(
        await el.evaluate((n) => n.querySelector('a,button') !== null)
      ).toBe(false);
    }
  });
});
