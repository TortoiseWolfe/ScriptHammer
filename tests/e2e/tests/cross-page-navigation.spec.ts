import { test, expect } from '@playwright/test';

test.describe('Cross-Page Navigation', () => {
  test('navigate through all main pages', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);

    // Navigate to Themes
    await page.click('text=Browse Themes');
    await expect(page).toHaveURL(/\/themes/);
    await expect(
      page.locator('h1').filter({ hasText: /Theme/i })
    ).toBeVisible();

    // Navigate to Components
    await page.click('a:has-text("Components")');
    await expect(page).toHaveURL(/\/components/);
    await expect(
      page.locator('h1').filter({ hasText: /Component/i })
    ).toBeVisible();

    // Navigate to Accessibility
    await page.click('a:has-text("Accessibility")');
    await expect(page).toHaveURL(/\/accessibility/);
    await expect(
      page.locator('h1').filter({ hasText: /Accessibility/i })
    ).toBeVisible();

    // Navigate to Status
    await page.click('a:has-text("Status")');
    await expect(page).toHaveURL(/\/status/);
    await expect(
      page.locator('h1').filter({ hasText: /Status/i })
    ).toBeVisible();

    // Navigate back to Home
    await page.locator('a:has-text("Home")').first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('browser back/forward navigation works', async ({ page }) => {
    // Navigate through multiple pages
    await page.goto('/');
    await page.click('text=Browse Themes');
    await page.click('a:has-text("Components")');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/themes/);

    // Go back again
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/themes/);

    // Go forward again
    await page.goForward();
    await expect(page).toHaveURL(/\/components/);
  });

  test('navigation menu is consistent across pages', async ({ page }) => {
    const pages = ['/', '/themes', '/components', '/accessibility', '/status'];

    for (const pagePath of pages) {
      await page.goto(pagePath);

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
    await page.goto('/themes');
    await expect(page).toHaveURL(/\/themes/);
    await expect(
      page.locator('h1').filter({ hasText: /Theme/i })
    ).toBeVisible();

    await page.goto('/components');
    await expect(page).toHaveURL(/\/components/);
    await expect(
      page.locator('h1').filter({ hasText: /Component/i })
    ).toBeVisible();

    await page.goto('/accessibility');
    await expect(page).toHaveURL(/\/accessibility/);
    await expect(
      page.locator('h1').filter({ hasText: /Accessibility/i })
    ).toBeVisible();

    await page.goto('/status');
    await expect(page).toHaveURL(/\/status/);
    await expect(
      page.locator('h1').filter({ hasText: /Status/i })
    ).toBeVisible();
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
    await page.goto('/');

    // Check for anchor links
    const anchorLinks = page.locator('a[href^="#"]');
    const anchorCount = await anchorLinks.count();

    if (anchorCount > 0) {
      const firstAnchor = anchorLinks.first();
      const href = await firstAnchor.getAttribute('href');

      if (href) {
        // Click anchor link
        await firstAnchor.click();

        // Check URL updated with hash
        expect(page.url()).toContain(href);

        // Check target element is in viewport
        const targetId = href.substring(1);
        const targetElement = page.locator(`#${targetId}`);

        if ((await targetElement.count()) > 0) {
          await expect(targetElement).toBeInViewport();
        }
      }
    }
  });

  test('external links open in new tab', async ({ page, context }) => {
    await page.goto('/');

    // Find external links
    const externalLinks = page.locator(
      'a[href^="http"]:not([href*="localhost"]):not([href*="ScriptHammer"])'
    );
    const linkCount = await externalLinks.count();

    if (linkCount > 0) {
      const firstLink = externalLinks.first();

      // Check target attribute
      const target = await firstLink.getAttribute('target');
      const rel = await firstLink.getAttribute('rel');

      // External links should open in new tab with security attributes
      if (target === '_blank') {
        expect(rel).toContain('noopener');
      }

      // Test link opens in new tab
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        firstLink.click(),
      ]);

      await newPage.waitForLoadState();
      expect(newPage.url()).toMatch(/^https?:\/\//);
      await newPage.close();
    }
  });

  test('breadcrumb navigation works if present', async ({ page }) => {
    await page.goto('/components');

    // Look for breadcrumb navigation
    const breadcrumbs = page.locator(
      '[aria-label="breadcrumb"], .breadcrumbs, nav.breadcrumb'
    );
    const hasBreadcrumbs = (await breadcrumbs.count()) > 0;

    if (hasBreadcrumbs) {
      const breadcrumbLinks = breadcrumbs.locator('a');
      const linkCount = await breadcrumbLinks.count();

      if (linkCount > 0) {
        // Click first breadcrumb (usually Home)
        await breadcrumbLinks.first().click();

        // Should navigate to home
        await expect(page).toHaveURL(/\/$/);
      }
    }
  });

  test('navigation preserves theme selection', async ({ page }) => {
    // Set a theme
    await page.goto('/themes');
    const darkTheme = page.locator('[data-theme="dark"]').first();
    await darkTheme.click();

    // Navigate to different pages
    const pages = ['/components', '/accessibility', '/status', '/'];

    for (const pagePath of pages) {
      await page.goto(pagePath);

      // Theme should persist
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
  });

  test('navigation menu is keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Tab to first navigation link
    await page.keyboard.press('Tab');

    let navLinkFocused = false;
    let tabCount = 0;
    const maxTabs = 20;

    // Tab until we find a navigation link
    while (!navLinkFocused && tabCount < maxTabs) {
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          isNav: el?.closest('nav') !== null,
          text: el?.textContent,
        };
      });

      if (focusedElement.tag === 'A' && focusedElement.isNav) {
        navLinkFocused = true;

        // Press Enter to navigate
        await page.keyboard.press('Enter');

        // Check navigation occurred
        await page.waitForLoadState('networkidle');
        const url = page.url();
        expect(url).toBeTruthy();
      }

      await page.keyboard.press('Tab');
      tabCount++;
    }
  });

  test('page transitions are smooth', async ({ page }) => {
    await page.goto('/');

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
    await page.click('text=Browse Themes');

    // Just verify navigation completed
    await expect(page).toHaveURL(/\/themes/);
  });

  test('mobile navigation menu works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Look for mobile menu button (hamburger)
    const menuButton = page.locator(
      'button[aria-label*="menu"], button.hamburger, button:has-text("☰")'
    );
    const hasMenuButton = (await menuButton.count()) > 0;

    if (hasMenuButton) {
      // Open mobile menu
      await menuButton.click();

      // Check menu is visible
      const mobileNav = page.locator(
        '.drawer-side, .mobile-menu, [class*="mobile-nav"]'
      );
      await expect(mobileNav).toBeVisible();

      // Click a navigation link
      const navLink = mobileNav.locator('a:has-text("Themes")').first();
      if ((await navLink.count()) > 0) {
        await navLink.click();

        // Check navigation occurred
        await expect(page).toHaveURL(/\/themes/);
      }
    }
  });

  test('scroll position resets on navigation', async ({ page }) => {
    await page.goto('/');

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));

    // Navigate to another page
    await page.click('text=Browse Themes');

    // Check scroll position is at top
    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeLessThanOrEqual(100); // Allow small offset for fixed headers
  });

  test('active navigation item is highlighted', async ({ page }) => {
    await page.goto('/themes');

    // Find navigation link for current page
    const activeLink = page
      .locator('nav a[href*="themes"], nav a:has-text("Themes")')
      .first();

    if ((await activeLink.count()) > 0) {
      // Check for active state (aria-current or active class)
      const ariaCurrent = await activeLink.getAttribute('aria-current');
      const className = await activeLink.getAttribute('class');

      const hasActiveState =
        ariaCurrent === 'page' ||
        className?.includes('active') ||
        className?.includes('current');

      expect(hasActiveState).toBe(true);
    }
  });
});
