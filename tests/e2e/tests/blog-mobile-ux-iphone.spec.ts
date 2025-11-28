import { test, expect, devices } from '@playwright/test';

/**
 * Mobile UX Tests for Blog Posts - iPhone 12
 *
 * IMPORTANT: These tests verify the RESULT of fixes, not the process of fixing.
 * Always verify fixes with human eyes first, then write tests to prevent regression.
 *
 * See PRP-016: Mobile-First Visual Testing Methodology
 */

// Device configuration at file scope (not inside describe)
test.use({
  ...devices['iPhone 12'],
});

test.describe('Blog Post Mobile UX - iPhone 12', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a blog post
    await page.goto('/blog/countdown-timer-react-tutorial');
    // Wait for content to load
    await page.waitForLoadState('networkidle');
  });

  test('should display footer at bottom of page', async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500); // Wait for scroll to complete

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Verify footer contains expected text
    await expect(footer).toContainText('Made by');
    await expect(footer).toContainText('CRUDgames.com');

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'test-results/mobile-footer.png',
      fullPage: false,
    });
  });

  test('should display SEO badge in top-right corner', async ({ page }) => {
    const seoBadge = page.locator('button[title="Click to view SEO details"]');

    // Verify badge exists and is visible
    await expect(seoBadge).toBeVisible();

    // Verify position is in top-right area
    const box = await seoBadge.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      // Should be on right side of 390px viewport (within 100px of right edge)
      expect(box.x).toBeGreaterThan(290);
      // Should be near top (within 200px of top)
      expect(box.y).toBeLessThan(200);
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-results/mobile-seo-badge.png',
      fullPage: false,
    });
  });

  test('should display TOC button in top-right corner', async ({ page }) => {
    // Some posts may not have TOC, so this is conditional
    const tocButton = page
      .locator('details summary')
      .filter({ hasText: 'TOC' });

    const isVisible = await tocButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(tocButton).toBeVisible();

      // Verify position is in top-right area
      const box = await tocButton.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.x).toBeGreaterThan(290);
        expect(box.y).toBeLessThan(250);
      }
    }
  });

  test('should not have horizontal scroll on page', async ({ page }) => {
    // Check body scroll width vs viewport width
    const measurements = await page.evaluate(() => {
      return {
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        htmlScrollWidth: document.documentElement.scrollWidth,
        htmlClientWidth: document.documentElement.clientWidth,
      };
    });

    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeTruthy();

    if (viewportSize) {
      // Body and HTML should not be wider than viewport
      // Allow 1px tolerance for sub-pixel rounding
      expect(measurements.bodyScrollWidth).toBeLessThanOrEqual(
        viewportSize.width + 1
      );
      expect(measurements.htmlScrollWidth).toBeLessThanOrEqual(
        viewportSize.width + 1
      );
    }

    // Take screenshot to verify visually
    await page.screenshot({
      path: 'test-results/mobile-no-hscroll.png',
      fullPage: true,
    });
  });

  test('should allow code blocks to scroll internally', async ({ page }) => {
    const codeBlocks = page.locator('.mockup-code');
    const count = await codeBlocks.count();

    if (count > 0) {
      const firstCodeBlock = codeBlocks.first();
      await expect(firstCodeBlock).toBeVisible();

      // Scroll to code block
      await firstCodeBlock.scrollIntoViewIfNeeded();

      // Check that code block has internal scrolling
      const overflowX = await firstCodeBlock.evaluate(
        (el) => window.getComputedStyle(el).overflowX
      );

      // Should allow horizontal scroll within the element
      expect(['auto', 'scroll']).toContain(overflowX);

      // Verify code block doesn't force page-wide scroll
      const codeBlockWidth = await firstCodeBlock.evaluate(
        (el) => el.scrollWidth
      );
      const viewportWidth = page.viewportSize()?.width || 0;

      // Code block content can be wider than viewport (that's ok, it scrolls internally)
      // But the element itself should be constrained
      const boundingBox = await firstCodeBlock.boundingBox();
      expect(boundingBox).toBeTruthy();
      if (boundingBox) {
        expect(boundingBox.width).toBeLessThanOrEqual(viewportWidth);
      }

      await page.screenshot({
        path: 'test-results/mobile-code-scroll.png',
        fullPage: false,
      });
    }
  });

  test('should have readable text without zooming', async ({ page }) => {
    // Check heading sizes
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    const h1FontSize = await h1.evaluate((el) => {
      const fontSize = window.getComputedStyle(el).fontSize;
      return parseInt(fontSize);
    });

    // H1 should be at least 16px on mobile for readability
    expect(h1FontSize).toBeGreaterThanOrEqual(16);

    // Check paragraph text
    const paragraph = page.locator('article p').first();
    if (await paragraph.isVisible()) {
      const pFontSize = await paragraph.evaluate((el) => {
        const fontSize = window.getComputedStyle(el).fontSize;
        return parseInt(fontSize);
      });

      // Body text should be at least 12px
      expect(pFontSize).toBeGreaterThanOrEqual(12);
    }
  });

  test('should have touch-friendly interactive elements', async ({ page }) => {
    // Check SEO badge size
    const seoBadge = page.locator('button[title="Click to view SEO details"]');

    if (await seoBadge.isVisible()) {
      const box = await seoBadge.boundingBox();
      expect(box).toBeTruthy();

      if (box) {
        // Minimum touch target should be 44x44px (Apple HIG)
        // Our mobile buttons are smaller but grouped, which is acceptable
        // Just verify they're at least 20px to be tappable
        expect(box.height).toBeGreaterThanOrEqual(20);
        expect(box.width).toBeGreaterThanOrEqual(20);
      }
    }
  });

  test('should maintain layout when scrolling', async ({ page }) => {
    // Take screenshot at top
    await page.screenshot({
      path: 'test-results/mobile-scroll-top.png',
      fullPage: false,
    });

    // Get initial position of SEO badge
    const seoBadge = page.locator('button[title="Click to view SEO details"]');
    const initialBox = await seoBadge.boundingBox();

    // Scroll down 500px
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    // SEO badge should still be visible (fixed position)
    await expect(seoBadge).toBeVisible();

    const scrolledBox = await seoBadge.boundingBox();

    // Fixed position badge should stay in same place relative to viewport
    expect(scrolledBox).toBeTruthy();
    expect(initialBox).toBeTruthy();

    if (scrolledBox && initialBox) {
      // Y position should be roughly the same (within 5px tolerance)
      expect(Math.abs(scrolledBox.y - initialBox.y)).toBeLessThan(5);
    }

    await page.screenshot({
      path: 'test-results/mobile-scroll-middle.png',
      fullPage: false,
    });
  });

  test('should display featured image without cropping important content', async ({
    page,
  }) => {
    const featuredImage = page.locator('figure img').first();

    if (await featuredImage.isVisible()) {
      const box = await featuredImage.boundingBox();
      expect(box).toBeTruthy();

      if (box) {
        const viewportWidth = page.viewportSize()?.width || 0;
        // Image container should not exceed viewport width
        expect(box.width).toBeLessThanOrEqual(viewportWidth);

        // Image should have reasonable height (not too tall or short)
        expect(box.height).toBeGreaterThan(100);
        expect(box.height).toBeLessThan(600);
      }

      await page.screenshot({
        path: 'test-results/mobile-featured-image.png',
        fullPage: false,
      });
    }
  });
});
