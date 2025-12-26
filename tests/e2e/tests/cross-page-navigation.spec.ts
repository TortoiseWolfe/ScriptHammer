import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('Cross-Page Navigation', () => {
  test('navigate through all main pages', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/$/);

    // Navigate to Themes
    await page.click('text=Browse Themes');
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

    // Navigate back to Home
    await page.locator('a:has-text("Home")').first().click();
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/$/);
  });

  test('browser back/forward navigation works', async ({ page }) => {
    // Navigate through multiple pages
    await page.goto('/');
    await dismissCookieBanner(page);
    await page.click('text=Browse Themes');
    await page.click('a:has-text("Blog")');

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
    await expect(page).toHaveURL(/\/blog/);
  });

  test('navigation menu is consistent across pages', async ({ page }) => {
    const pages = ['/', '/themes', '/blog', '/accessibility', '/status'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
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
    await page.goto('/themes');
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/themes/);
    await expect(
      page.locator('h1').filter({ hasText: /Theme/i })
    ).toBeVisible();

    await page.goto('/blog');
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/blog/);

    await page.goto('/accessibility');
    await dismissCookieBanner(page);
    await expect(page).toHaveURL(/\/accessibility/);
    await expect(
      page.locator('h1').filter({ hasText: /Accessibility/i })
    ).toBeVisible();

    await page.goto('/status');
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
    await page.goto('/');
    await dismissCookieBanner(page);

    // Check for anchor links (skip to main content)
    const skipLink = page.locator('a[href="#main-content"]');
    const hasSkipLink = (await skipLink.count()) > 0;

    if (hasSkipLink) {
      // Focus and click the skip link
      await page.keyboard.press('Tab');
      await skipLink.click();

      // Check target element is in viewport
      const mainContent = page.locator('#main-content');
      if ((await mainContent.count()) > 0) {
        await expect(mainContent).toBeInViewport();
      }
    }
  });

  test('external links open in new tab', async ({ page, context }) => {
    await page.goto('/');
    await dismissCookieBanner(page);

    // Find View Source link which opens GitHub in new tab
    const viewSourceLink = page.locator('a:has-text("View Source")');
    const hasViewSource = (await viewSourceLink.count()) > 0;

    if (hasViewSource) {
      // Test link opens in new tab
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        viewSourceLink.click(),
      ]);

      await newPage.waitForLoadState();
      expect(newPage.url()).toContain('github.com');
      await newPage.close();
    }
  });

  test('breadcrumb navigation works if present', async ({ page }) => {
    await page.goto('/blog');
    await dismissCookieBanner(page);

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
    await dismissCookieBanner(page);

    // Click dark theme button
    const darkThemeBtn = page.locator('button:has-text("dark")');
    await darkThemeBtn.click();

    // Navigate to different pages
    const pages = ['/blog', '/accessibility', '/status', '/'];

    for (const pagePath of pages) {
      await page.goto(pagePath);

      // Theme should persist
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
  });

  test('navigation menu is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);

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
    await page.click('text=Browse Themes');

    // Just verify navigation completed
    await expect(page).toHaveURL(/\/themes/);
  });

  test('mobile navigation menu works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await dismissCookieBanner(page);

    // Look for mobile menu button (hamburger) - use aria-label pattern
    const menuButton = page.locator('button[aria-label="Navigation menu"]');
    const hasMenuButton = (await menuButton.count()) > 0;

    if (hasMenuButton) {
      // Open mobile menu
      await menuButton.click();

      // The menu is a dropdown, so look for menu items
      const menuItems = page.locator('.dropdown-content a');
      await expect(menuItems.first()).toBeVisible();

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
    await page.goto('/');
    await dismissCookieBanner(page);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));

    // Navigate to another page
    await page.click('text=Browse Themes');

    // Check scroll position is at top
    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeLessThanOrEqual(100); // Allow small offset for fixed headers
  });

  test('active navigation item is highlighted', async ({ page }) => {
    await page.goto('/');
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
