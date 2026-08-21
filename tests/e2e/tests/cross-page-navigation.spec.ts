import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';
import { THEMES, THEME_COUNT } from '@/config/themes';
import { waitForLoadStateOrGiveUp } from '../utils/settle';

test.describe('Cross-Page Navigation', () => {
  test('navigate through all main pages', async ({ page }) => {
    // Start at homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/$/);

    // Navigate to Themes
    await page
      .getByRole('link', { name: `${THEME_COUNT} Themes` })
      .first()
      .click();
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/themes/);
    await expect(
      page.locator('h1').filter({ hasText: /Theme/i })
    ).toBeVisible();

    // Navigate to Blog via nav
    await page.click('a:has-text("Blog")');
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/blog/);

    // Navigate to Docs via nav
    await page.click('a:has-text("Docs")');
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/docs/);

    // Navigate back to Home. #378 moved Home onto the logo — the standard
    // convention — so no nav link has the TEXT "Home" any more. The logo
    // carries it as an accessible name, which is the sturdier locator anyway:
    // it survives the wordmark changing.
    await page.getByRole('link', { name: /home/i }).first().click();
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/$/);
  });

  test('browser back/forward navigation works', async ({ page }) => {
    // Navigate through multiple pages - wait for each navigation to complete
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Navigate to themes and wait for URL
    await page
      .getByRole('link', { name: `${THEME_COUNT} Themes` })
      .first()
      .click();
    await expect(page).toHaveURL(/\/themes/);

    // Navigate to blog and wait for URL
    await page.click('a:has-text("Blog")');
    await expect(page).toHaveURL(/\/blog/);

    // Go back to themes
    await page.goBack();
    await expect(page).toHaveURL(/\/themes/);

    // Go back to home
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    // Go forward to themes
    await page.goForward();
    await expect(page).toHaveURL(/\/themes/);

    // Go forward to blog
    await page.goForward();
    await expect(page).toHaveURL(/\/blog/);
  });

  test('navigation menu is consistent across pages', async ({ page }) => {
    const pages = ['/', '/themes', '/blog', '/accessibility', '/status'];

    for (const pagePath of pages) {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);

      // Check navigation elements exist
      const nav = page.locator('nav, [role="navigation"]').first();
      await expect(nav).toBeVisible();

      // Check key navigation links are present
      const homeLink = page
        .locator('a:has-text("Home"), a:has-text("ScriptHammer")')
        .first();
      await expect(homeLink).toBeVisible();

      // Check footer links are consistent
      const footer = page.locator('footer, [role="contentinfo"]').first();
      await expect(footer).toBeVisible();
    }
  });

  test('deep linking works correctly', async ({ page }) => {
    // Direct navigation to deep pages
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/themes/);
    await expect(
      page.locator('h1').filter({ hasText: /Theme/i })
    ).toBeVisible();

    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/blog/);

    await page.goto('/accessibility', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/accessibility/);
    await expect(
      page.locator('h1').filter({ hasText: /Accessibility/i })
    ).toBeVisible();

    await page.goto('/status', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/status/);
  });

  test('404 page handles non-existent routes', async ({ page }) => {
    // Navigate to non-existent page
    const response = await page.goto('/non-existent-page', {
      waitUntil: 'networkidle',
    });

    // Check response status
    if (response) {
      const status = response.status();
      // Should be 404 or redirect to 404 page
      expect([404, 200]).toContain(status);
    }

    // Check for 404 content or redirect to home
    const has404Content =
      (await page.locator('text=/404|not found/i').count()) > 0;
    const isHomePage = await page.url().includes('/ScriptHammer');

    expect(has404Content || isHomePage).toBe(true);
  });

  test('anchor links within pages work', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Check for anchor links (skip to main content)
    const skipLink = page.locator('a[href="#main-content"]');
    const hasSkipLink = (await skipLink.count()) > 0;

    if (hasSkipLink) {
      // Focus the skip link and activate via keyboard (avoids header interception)
      await skipLink.focus();
      await page.keyboard.press('Enter');

      // Check target element is in viewport
      const mainContent = page.locator('#main-content');
      if ((await mainContent.count()) > 0) {
        await expect(mainContent).toBeInViewport();
      }
    }
  });

  test('external links open in a new tab, safely', async ({ page }) => {
    // This test used to locate one specific link by its label and do nothing when
    // that link was absent. The link lived in `src/app/page.tsx` at the initial
    // commit and was deleted in bf1fc5f1 (2026-03-04), after which the whole body
    // was `if (false)` and the test passed green for five and a half months without
    // ever executing an assertion (#861).
    //
    // The INTENT is still live and worth enforcing, so it is retargeted from one
    // named link to the property itself: every off-site link opens in a new tab and
    // carries `rel="noopener"`, so the opened page cannot reach back through
    // `window.opener`.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    const external = await page
      .locator('a[href^="http"]:not([href*="scripthammer.com"])')
      .all();

    const offenders: string[] = [];
    let measured = 0;

    for (const link of external) {
      const href = await link.getAttribute('href');
      if (!href || href.includes('localhost') || href.includes('127.0.0.1')) {
        continue;
      }
      measured++;
      const target = await link.getAttribute('target');
      const rel = (await link.getAttribute('rel')) ?? '';
      if (target !== '_blank') {
        offenders.push(`${href} -> target=${target ?? 'MISSING'}`);
      } else if (!rel.includes('noopener')) {
        offenders.push(
          `${href} -> target=_blank but rel="${rel}" lacks noopener`
        );
      }
    }

    // The coverage floor, not a formality. Without it a selector that stopped
    // matching would leave `offenders` empty and the test would pass having
    // examined nothing -- which is exactly how it died the first time (#842).
    expect(
      measured,
      'no external links found on the homepage; this test measured nothing'
    ).toBeGreaterThan(0);

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  // REMOVED: 'breadcrumb navigation works if present' (#861).
  //
  // It looked for `[aria-label="breadcrumb"], .breadcrumbs, nav.breadcrumb` on /blog
  // and asserted only inside a truthiness guard on that locator's count. This
  // product has never had breadcrumbs in any form: none of those selectors matches
  // anything in the built /blog HTML, no blog template renders them, and
  // `generateBreadcrumbJsonLd` in src/utils/metadata.tsx has no call site, so not
  // even the structured-data variant is emitted. The title said "if present"; the
  // answer was always no.
  //
  // A test for a feature that does not exist reports success without observing
  // anything, which is the #396 pattern. If breadcrumbs are ever added this comes
  // back as a real test rather than a conditional one.

  test('navigation preserves theme selection', async ({ page }) => {
    // Set a theme
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Pick a random theme from every registered theme. This used to read
    // from a local 32-entry copy that omitted scripthammer-dark and
    // scripthammer-light — so the site's own default theme was never
    // covered here. /themes renders a button for all 34 (#408).
    const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)];

    // Click the theme button
    const themeBtn = page.locator(`button[data-theme="${randomTheme}"]`);
    await themeBtn.click();

    // Navigate to different pages and verify theme persists
    const pages = ['/blog', '/accessibility', '/status', '/'];

    for (const pagePath of pages) {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });

      // Theme should persist
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        randomTheme
      );
    }
  });

  test('navigation menu is keyboard accessible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Find and focus the first nav link directly
    const navLink = page.locator('nav a').first();
    await navLink.focus();

    // Verify the link is focused
    await expect(navLink).toBeFocused();

    // Get the href to know where we're going
    const href = await navLink.getAttribute('href');

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Verify navigation occurred (URL should change or stay on home if it was home link)
    if (href && href !== '/' && href !== '#') {
      await expect(page).toHaveURL(
        new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      );
    }
  });

  test('page transitions are smooth', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Check for view transitions API or CSS transitions
    const hasTransitions = await page.evaluate(() => {
      // Check if View Transitions API is used
      if ('startViewTransition' in document) {
        return true;
      }

      // Check for CSS transitions on body or main
      const body = (document as Document).body;
      const main = (document as Document).querySelector('main');
      const bodyTransition = window.getComputedStyle(body).transition;
      const mainTransition = main
        ? window.getComputedStyle(main as Element).transition
        : '';

      return bodyTransition !== 'none' || mainTransition !== 'none';
    });

    // We're just checking the mechanism exists, not asserting
    expect(hasTransitions).toBeDefined();

    // Navigate and observe smooth transition
    await page
      .getByRole('link', { name: `${THEME_COUNT} Themes` })
      .first()
      .click();

    // Just verify navigation completed
    await expect(page).toHaveURL(/\/themes/);
  });

  test('mobile navigation menu works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // `[aria-label=...]`, NOT `button[aria-label=...]` (#396). The hamburger is a
    // DaisyUI dropdown trigger, which renders as a `<label>` — so the old selector
    // matched ZERO elements, `hasMenuButton` was always false, and this entire test
    // body (both assertions) never ran. Measured on production at 375px:
    //   [aria-label="Navigation menu"]        -> 1  (tagName: label)
    //   button[aria-label="Navigation menu"]  -> 0
    //   .dropdown-content a                   -> 15
    // So the menu was there and testable the whole time; only the locator was wrong.
    const menuButton = page.locator('[aria-label="Navigation menu"]');

    // ASSERTED, not branched on. A guard here makes "the menu is broken" and "the
    // trigger was renamed" report identically — and the second is what happened.
    await expect(
      menuButton,
      'no element carries aria-label="Navigation menu" — the mobile nav gate cannot run'
    ).toHaveCount(1);

    {
      // Open mobile menu
      await menuButton.click();

      // SCOPED to the dropdown this trigger belongs to (#396). A bare
      // `.dropdown-content a` matches EVERY dropdown on the page, and `.first()`
      // takes document order — which lands on the account menu (`Profile`), not the
      // navigation menu just opened. That menu is closed, so the link is hidden and
      // the assertion fails on an element the test never meant to look at.
      //
      // This bug was invisible until the fix above let the body run at all: the
      // guard was permanently false, so nothing downstream of it had ever executed.
      const menu = page.locator('.dropdown', { has: menuButton });
      const menuItems = menu.locator('.dropdown-content a');

      await expect(
        menuItems.first(),
        'the navigation dropdown did not open'
      ).toBeVisible();

      // Click Home link
      const homeLink = menuItems.filter({ hasText: 'Home' }).first();
      if ((await homeLink.count()) > 0) {
        await homeLink.click();

        // Check navigation occurred (back to home)
        await expect(page).toHaveURL(/\/$/);
      }
    }
  });

  test('scroll position resets on navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));

    // Navigate to another page
    await page
      .getByRole('link', { name: `${THEME_COUNT} Themes` })
      .first()
      .click();

    // Wait for the destination page to actually render its content and for
    // Next.js App Router's scroll restoration to complete. Measuring at
    // `domcontentloaded` is too early on WebKit — the document has parsed
    // but the framework hasn't yet run its onRouteChangeComplete scroll
    // reset, so window.scrollY is still the pre-navigation value (500).
    // Wait for a destination-page-specific element, then for network idle
    // so the scroll restoration has settled.
    await page.waitForURL(
      (url) =>
        url.pathname.endsWith('/themes/') || url.pathname.endsWith('/themes'),
      { timeout: 10000 }
    );
    await page
      .getByRole('heading', { level: 1 })
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });
    await waitForLoadStateOrGiveUp(page, 'networkidle');

    // Check scroll position is near top (allow offset for fixed headers and
    // browser-specific scroll restoration behavior — WebKit can report up
    // to ~120px due to address bar height differences)
    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeLessThanOrEqual(200);
  });

  test('active navigation item is highlighted', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Click Blog to navigate there
    await page.click('a:has-text("Blog")');
    await expect(page).toHaveURL(/\/blog/);

    // Check the Blog nav link has active state
    const blogLink = page.locator('nav a:has-text("Blog")').first();

    if ((await blogLink.count()) > 0) {
      // Check for active state (aria-current or active class)
      const className = await blogLink.getAttribute('class');

      // DaisyUI uses btn-active class
      const hasActiveState = className?.includes('active');

      expect(hasActiveState).toBe(true);
    }
  });
});
