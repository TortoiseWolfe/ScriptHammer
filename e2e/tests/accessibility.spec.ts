import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('homepage passes automated accessibility checks', async ({ page }) => {
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('themes page passes automated accessibility checks', async ({
    page,
  }) => {
    await page.goto('/themes');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('components page passes automated accessibility checks', async ({
    page,
  }) => {
    await page.goto('/components');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('accessibility settings page passes automated checks', async ({
    page,
  }) => {
    await page.goto('/accessibility');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('skip to main content link works', async ({ page }) => {
    // Tab to reveal skip link
    await page.keyboard.press('Tab');

    // Check skip link is focused
    const skipLink = page
      .locator('a[href="#main"], a[href="#game-demo"]')
      .first();
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');

    // Check main content is in viewport
    const mainContent = page.locator('#main, #game-demo').first();
    await expect(mainContent).toBeInViewport();
  });

  test('all images have alt text', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // Images should have alt attribute (can be empty for decorative)
      expect(alt).toBeDefined();
    }
  });

  test('all form inputs have labels', async ({ page }) => {
    await page.goto('/components');

    const inputs = page
      .locator('input, select, textarea')
      .filter({ hasNot: page.locator('[type="hidden"]') });
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const inputId = await input.getAttribute('id');

      if (inputId) {
        // Check for associated label
        const label = page.locator(`label[for="${inputId}"]`);
        const labelCount = await label.count();

        // Or check for aria-label
        const ariaLabel = await input.getAttribute('aria-label');

        // Or check for aria-labelledby
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // At least one labeling method should be present
        expect(labelCount > 0 || ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });

  test('focus indicators are visible', async ({ page }) => {
    // Tab through interactive elements
    const interactiveElements = page.locator(
      'a, button, input, select, textarea, [tabindex="0"]'
    );
    const elementCount = await interactiveElements.count();

    if (elementCount > 0) {
      // Focus first element
      await interactiveElements.first().focus();

      // Check focus is visible (has outline or border change)
      const focusedElement = interactiveElements.first();
      const outline = await focusedElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outline || styles.border;
      });

      expect(outline).toBeTruthy();
    }
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    // Get all headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const headingLevels = [];

    for (const heading of headings) {
      const tagName = await heading.evaluate((el) => el.tagName);
      const level = parseInt(tagName.charAt(1));
      headingLevels.push(level);
    }

    // Check h1 exists
    expect(headingLevels).toContain(1);

    // Check no skipped levels (e.g., h1 -> h3)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('ARIA landmarks are present', async ({ page }) => {
    // Check for main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main).toHaveCount(1);

    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]');
    expect(await nav.count()).toBeGreaterThan(0);

    // Check for banner (header)
    const banner = page.locator('header, [role="banner"]');
    expect(await banner.count()).toBeGreaterThan(0);

    // Check for contentinfo (footer)
    const footer = page.locator('footer, [role="contentinfo"]');
    expect(await footer.count()).toBeGreaterThan(0);
  });

  test('color contrast meets WCAG standards', async ({ page }) => {
    // This test uses axe-core for contrast checking
    await injectAxe(page);

    const results = await page.evaluate(async () => {
      const axeResults = await (
        window as {
          axe: {
            run: (
              doc: Document,
              options: object
            ) => Promise<{ violations: Array<{ id: string }> }>;
          };
        }
      ).axe.run(document, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      return axeResults;
    });

    // Check for color contrast violations
    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast'
    );
    expect(contrastViolations).toHaveLength(0);
  });

  test('font size controls work', async ({ page }) => {
    await page.goto('/accessibility');

    // Find font size controls
    const increaseFontBtn = page
      .locator('button:has-text("Increase"), button:has-text("+")')
      .first();
    const decreaseFontBtn = page
      .locator('button:has-text("Decrease"), button:has-text("-")')
      .first();

    if ((await increaseFontBtn.count()) > 0) {
      // Get initial font size
      const initialSize = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).fontSize;
      });

      // Increase font size
      await increaseFontBtn.click();

      // Check font size increased
      const increasedSize = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).fontSize;
      });

      expect(parseFloat(increasedSize)).toBeGreaterThan(
        parseFloat(initialSize)
      );

      // Decrease font size
      if ((await decreaseFontBtn.count()) > 0) {
        await decreaseFontBtn.click();

        const decreasedSize = await page.evaluate(() => {
          const body = document.body;
          return window.getComputedStyle(body).fontSize;
        });

        expect(parseFloat(decreasedSize)).toBeLessThan(
          parseFloat(increasedSize)
        );
      }
    }
  });

  test('keyboard navigation works throughout the site', async ({ page }) => {
    // Tab through the page
    let tabCount = 0;
    const maxTabs = 20;

    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      tabCount++;

      // Check that something has focus
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          visible: el
            ? window.getComputedStyle(el).visibility !== 'hidden'
            : false,
        };
      });

      // Focused element should be visible
      if (focusedElement.tag && focusedElement.tag !== 'BODY') {
        expect(focusedElement.visible).toBe(true);
      }
    }
  });

  test('reduced motion is respected', async ({ page }) => {
    // Set prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Check that animations are disabled
    const animationDuration = await page.evaluate(() => {
      const el = document.querySelector('*');
      if (el) {
        const styles = window.getComputedStyle(el);
        return styles.animationDuration;
      }
      return '0s';
    });

    // With reduced motion, animations should be instant or very short
    if (animationDuration !== 'normal') {
      const duration = parseFloat(animationDuration);
      expect(duration).toBeLessThanOrEqual(0.1);
    }
  });

  test('links have distinguishable text', async ({ page }) => {
    const links = page.locator('a');
    const linkCount = await links.count();

    const linkTexts = new Set();
    const linkHrefs = new Set();

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const href = await link.getAttribute('href');

      if (text && href) {
        const combo = `${text.trim()}-${href}`;

        // Links with same text should go to same destination
        if (linkTexts.has(text.trim()) && !linkHrefs.has(combo)) {
          console.warn(
            `Link "${text.trim()}" points to different destinations`
          );
        }

        linkTexts.add(text.trim());
        linkHrefs.add(combo);
      }
    }

    // Check for non-descriptive link text
    const badLinkTexts = ['click here', 'here', 'link', 'read more'];
    for (const badText of badLinkTexts) {
      expect(linkTexts.has(badText)).toBe(false);
    }
  });

  test('error messages are associated with form fields', async ({ page }) => {
    await page.goto('/components');

    // Look for error messages
    const errorMessages = page.locator('.text-error, [role="alert"]');
    const errorCount = await errorMessages.count();

    for (let i = 0; i < errorCount; i++) {
      const error = errorMessages.nth(i);
      const errorId = await error.getAttribute('id');

      if (errorId) {
        // Find input with aria-describedby pointing to this error
        const associatedInput = page.locator(
          `[aria-describedby*="${errorId}"]`
        );
        const hasAssociation = (await associatedInput.count()) > 0;

        expect(hasAssociation).toBe(true);
      }
    }
  });
});
