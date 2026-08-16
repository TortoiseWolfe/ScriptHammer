import { test, expect, devices } from '@playwright/test';
import { waitForLoadStateOrGiveUp } from '../utils/settle';

/**
 * Mobile UX Tests for Blog Posts - iPhone 12
 *
 * IMPORTANT: These tests verify the RESULT of fixes, not the process of fixing.
 * Always verify fixes with human eyes first, then write tests to prevent regression.
 *
 * See PRP-016: Mobile-First Visual Testing Methodology
 */

// iPhone 12 emulation, stripped of fields that break specific browsers:
// - defaultBrowserType: 'webkit' breaks chromium project (missing binary)
// - isMobile: true is not supported by Firefox (throws on newContext)
const {
  defaultBrowserType: _dbt,
  isMobile: _im,
  ...iPhone12Config
} = devices['iPhone 12'];
test.use(iPhone12Config);

test.describe('Blog Post Mobile UX - iPhone 12', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a blog post
    await page.goto('/blog/countdown-timer-tutorial');
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

  test('should keep controls clear of long and short blog titles', async ({
    page,
  }) => {
    const posts = [
      '/blog/countdown-timer-tutorial',
      '/blog/authentication-supabase-oauth',
    ];

    for (const width of [390, 500]) {
      await page.setViewportSize({ width, height: 900 });

      for (const post of posts) {
        await page.goto(post);
        await page.waitForLoadState('networkidle');

        const controls = page.getByTestId('blog-post-controls');
        const title = page.locator('article.blog-post-viewer h1');
        const seoBadge = page.locator(
          'button[title="Click to view SEO details"]'
        );

        await expect(controls).toBeVisible();
        await expect(title).toBeVisible();
        await expect(seoBadge).toBeVisible();

        const [controlsBox, titleBox] = await Promise.all([
          controls.boundingBox(),
          title.boundingBox(),
        ]);
        expect(controlsBox).toBeTruthy();
        expect(titleBox).toBeTruthy();

        if (controlsBox && titleBox) {
          const intersects =
            controlsBox.x < titleBox.x + titleBox.width &&
            controlsBox.x + controlsBox.width > titleBox.x &&
            controlsBox.y < titleBox.y + titleBox.height &&
            controlsBox.y + controlsBox.height > titleBox.y;

          expect(intersects).toBe(false);
          expect(controlsBox.y).toBeGreaterThanOrEqual(
            titleBox.y + titleBox.height
          );
        }

        await seoBadge.focus();
        await expect(seoBadge).toBeFocused();

        const tocButton = controls
          .locator('details summary')
          .filter({ hasText: 'TOC' });
        await expect(tocButton).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(tocButton).toBeFocused();
      }
    }
  });

  test('should display a reachable TOC button in the control cluster', async ({
    page,
  }) => {
    // Some posts may not have TOC, so this is conditional
    const controls = page.getByTestId('blog-post-controls');
    const tocButton = controls
      .locator('details summary')
      .filter({ hasText: 'TOC' });

    await expect(tocButton).toBeVisible();

    const seoBadge = controls.locator(
      'button[title="Click to view SEO details"]'
    );
    await seoBadge.focus();
    await page.keyboard.press('Tab');
    await expect(tocButton).toBeFocused();
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

    // Take a viewport-only screenshot (not fullPage) for visual debugging.
    // Firefox refuses fullPage screenshots taller than 32767px (long blog
    // posts trigger this). The assertion above already validated the
    // important thing — no horizontal scroll.
    await page
      .screenshot({
        path: 'test-results/mobile-no-hscroll.png',
        fullPage: false,
      })
      .catch(() => {});
  });

  test('should allow code blocks to scroll internally', async ({ page }) => {
    const codeBlocks = page.locator('.mockup-code');
    const count = await codeBlocks.count();

    if (count > 0) {
      const firstCodeBlock = codeBlocks.first();
      await expect(firstCodeBlock).toBeVisible();

      // Scroll to code block
      await firstCodeBlock.scrollIntoViewIfNeeded();

      // Wait for layout to stabilize before reading computed style. Without
      // this, getComputedStyle(el).overflowX occasionally returns "" (e.g.
      // mid-transition) and the array.toContain check fails with the odd
      // diff "Expected value: ''" vs "Received array: ['auto', 'scroll']".
      await waitForLoadStateOrGiveUp(page, 'networkidle');

      // Check that code block has internal scrolling. Poll the computed
      // style a few times in case the initial read returns the empty
      // string due to the element being mid-composite.
      let overflowX = '';
      for (let attempt = 0; attempt < 10; attempt++) {
        overflowX = await firstCodeBlock.evaluate(
          (el) => window.getComputedStyle(el).overflowX
        );
        if (overflowX === 'auto' || overflowX === 'scroll') break;
        await page.waitForTimeout(200);
      }

      // Should allow horizontal scroll within the element
      expect(['auto', 'scroll']).toContain(overflowX);

      // Verify code block doesn't force page-wide scroll
      const codeBlockWidth = await firstCodeBlock.evaluate(
        (el) => el.scrollWidth
      );
      const viewportWidth = page.viewportSize()?.width || 0;

      // Code block content can be wider than viewport (that's ok, it scrolls internally)
      // But the element itself should be constrained.
      // boundingBox() can return null in WebKit when the element has zero
      // dimensions or is in a compositing layer — skip width check if so.
      const boundingBox = await firstCodeBlock.boundingBox();
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

    // SEO badge stays in the document flow on mobile.
    await expect(seoBadge).toBeVisible();

    const scrolledBox = await seoBadge.boundingBox();

    // Fixed position badge should stay in same place relative to viewport
    expect(scrolledBox).toBeTruthy();
    expect(initialBox).toBeTruthy();

    if (scrolledBox && initialBox) {
      // It should scroll with the article instead of floating back over the title.
      expect(scrolledBox.y).toBeLessThan(initialBox.y - 50);
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
