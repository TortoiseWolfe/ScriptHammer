import { test, expect } from '@playwright/test';
import { injectAxe } from 'axe-playwright';
import { dismissCookieBanner } from '../utils/test-user-factory';
import { expectNoA11yViolations } from '../utils/expect-no-a11y-violations';

// Axe rules to skip in automated checks:
// - color-contrast: Theme-dependent (the registered themes vary in contrast)
// - landmark-unique: Multiple nav elements (GlobalNav + footer) is acceptable
//
// These are axe RunOptions, passed straight through to `getViolations`. They used to be
// wrapped one level deeper, in the shape the old axe-playwright helper wanted; the
// violations API takes the inner object.
const axeRunOptions = {
  rules: {
    'color-contrast': { enabled: false },
    'landmark-unique': { enabled: false },
  },
};

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
  });

  test('homepage passes automated accessibility checks', async ({ page }) => {
    await injectAxe(page);
    await expectNoA11yViolations(page, axeRunOptions);
  });

  test('themes page passes automated accessibility checks', async ({
    page,
  }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await injectAxe(page);
    await expectNoA11yViolations(page, axeRunOptions);
  });

  test('sign-in page passes automated accessibility checks', async ({
    page,
  }) => {
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await injectAxe(page);
    // The sign-in page includes third-party OAuth widgets (Supabase/Clerk)
    // that we cannot control. Only CRITICAL violations fail here — preserving the
    // original `includedImpacts: ['critical']`.
    await expectNoA11yViolations(
      page,
      {
        rules: {
          ...axeRunOptions.rules,
          label: { enabled: false },
        },
      },
      ['critical']
    );
  });

  test('accessibility settings page passes automated checks', async ({
    page,
  }) => {
    await page.goto('/accessibility', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await injectAxe(page);
    await expectNoA11yViolations(page, axeRunOptions);
  });

  test('skip to main content link works', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Verify the skip link exists in the DOM
    const skipLink = page
      .locator('a[href="#main-content"], a[href="#game-demo"]')
      .first();
    await expect(skipLink).toBeAttached();

    // Focus the skip link programmatically — sr-only elements may not
    // receive Tab focus consistently across browsers (Firefox especially)
    await skipLink.focus();
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');

    // Check main content is in viewport
    const mainContent = page.locator('#main-content, #game-demo').first();
    await expect(mainContent).toBeInViewport();
  });

  /**
   * Routes that actually carry images. The describe's `beforeEach` lands on `/`,
   * which has ZERO `<img>` elements — so this test's loop never ran and it reported
   * zero assertions on every shard (#396). `/blog/` carries 14.
   */
  const IMAGE_ROUTES = ['/blog/', '/'];

  test('all images have alt text', async ({ page }) => {
    let checked = 0;
    const missing: string[] = [];

    for (const route of IMAGE_ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);

      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        checked++;

        // `not.toBeNull()`, NOT `toBeDefined()` (#396). `getAttribute` returns
        // `null` for a missing attribute, and `null` IS defined — so the previous
        // assertion passed for an image carrying no alt at all. Proven against a
        // real alt-less <img>: toBeDefined() passed, not.toBeNull() failed.
        //
        // An EMPTY alt is still correct: it marks an image as decorative. What must
        // not happen is the attribute being absent entirely.
        if (alt === null) {
          missing.push(
            `${route} — img[${i}] src=${await img.getAttribute('src')}`
          );
        }
      }
    }

    // Coverage floor. Without it, a route list that stops matching makes this pass
    // having inspected nothing — which is the state it was already in.
    expect(
      checked,
      `no <img> elements found across ${IMAGE_ROUTES.join(', ')} — this gate ` +
        'inspected nothing'
    ).toBeGreaterThan(0);

    expect(
      missing,
      `${missing.length} image(s) have no alt attribute:\n${missing.join('\n')}`
    ).toEqual([]);
  });

  test('all form inputs have labels', async ({ page }) => {
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Wait for form to be fully loaded
    await page.waitForSelector('form', { state: 'visible', timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');

    // `:not([type="hidden"])` in the selector, NOT `.filter({ hasNot })` (#391).
    // `hasNot` keeps elements that do not contain a DESCENDANT matching the
    // inner locator — and an <input> is void, so the condition was trivially
    // true for every element and hidden inputs were never excluded. The filter
    // did nothing at all.
    //
    // What it was failing to exclude, identified 2026-07-28: Cloudflare
    // Turnstile injects `<input type="hidden" name="cf-turnstile-response"
    // id="cf-chl-widget-<random>_response">` into the sign-in form. It carries
    // an id and no accessible name — correctly, because a hidden input needs
    // none — so the id-guarded assertion below flagged it. The id is
    // randomised per render and the input only exists once the widget has
    // loaded, which is why this failed intermittently rather than always.
    const inputs = page.locator('input:not([type="hidden"]), select, textarea');
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

  test('color contrast advisory (axe-core executes successfully)', async ({
    page,
  }) => {
    // ADVISORY TEST — does NOT enforce WCAG AA contrast ratios.
    //
    // Not all registered themes meet AA. The team has chosen
    // to surface contrast issues as warnings rather than CI failures so theme
    // experimentation isn't blocked. This test asserts that:
    //   1. axe-core injects and runs without throwing
    //   2. The results object is well-formed (has a .violations array)
    //
    // It does NOT pretend to enforce contrast. To enforce AA, replace the
    // advisory log below with `expect(contrastViolations.length).toBe(0)`
    // after the team commits to an AA-compliant default theme.
    await injectAxe(page);

    const results = await page.evaluate(async () => {
      const axeResults = await (
        window as {
          axe: {
            run: (
              doc: Document,
              options: object
            ) => Promise<{
              violations: Array<{ id: string; nodes: unknown[] }>;
            }>;
          };
        }
      ).axe.run(document, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      return axeResults;
    });

    // Real assertion: axe-core ran and returned a structured result.
    expect(results).toBeDefined();
    expect(Array.isArray(results.violations)).toBe(true);

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast'
    );

    if (contrastViolations.length > 0) {
      console.warn(
        `[Advisory] ${contrastViolations[0].nodes.length} color contrast issues found. ` +
          `This is theme-dependent and does NOT fail CI. ` +
          `To enforce: change this test to expect(contrastViolations.length).toBe(0).`
      );
    }
  });

  // Rewritten in #388. The previous version located
  // `button:has-text("Increase"), button:has-text("+")` — /accessibility
  // renders Small / Medium / Large / X large, so count() was 0, the entire
  // body was skipped, and the test passed with zero assertions while appearing
  // to cover this feature. It was also measuring getComputedStyle(body)
  // .fontSize, which this system never sets: the scale factor drives the
  // --text-* tokens that .text-* classes consume, not the root font size.
  test('font size controls actually resize text', async ({ page }) => {
    await page.goto('/accessibility', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // The preview heading carries `text-2xl`, so it resolves through
    // --text-2xl -> calc(... * var(--font-scale-factor)).
    const sample = page.getByRole('heading', { name: 'Sample Heading' });
    await expect(sample).toBeVisible();

    const sizeOf = () =>
      sample.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    const smallBtn = page.getByRole('button', { name: 'Small', exact: true });
    const xLargeBtn = page.getByRole('button', {
      name: 'X large',
      exact: true,
    });

    // Both controls must exist — if the labels change, this test must fail
    // rather than silently skip the way its predecessor did.
    await expect(smallBtn).toBeVisible();
    await expect(xLargeBtn).toBeVisible();

    await smallBtn.click();
    await expect
      .poll(sizeOf, { message: 'font size settles after picking Small' })
      .toBeGreaterThan(0);
    const smallSize = await sizeOf();

    await xLargeBtn.click();
    await expect
      .poll(sizeOf, { message: 'font size grows after picking X large' })
      .toBeGreaterThan(smallSize);

    const xLargeSize = await sizeOf();

    // Strict comparison. The documented factors are 1.25 and 2.125, so the
    // ratio should be ~1.7 — assert a real gap, not just "not smaller", so
    // that a regression which freezes scaling goes red.
    expect(xLargeSize).toBeGreaterThan(smallSize * 1.5);
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
    // Repointed from /sign-in to /contact (#850). SignInForm has NO field-level error
    // association to test: it renders a single form-level `role="alert"` with no `id`
    // (SignInForm.tsx:383), and both inputs carry native `required`, so an empty submit
    // is blocked by the browser and that alert never appears. The old version therefore
    // inspected a pristine form, `continue`d past every empty alert container, and its
    // loop body never executed on any shard. Its own closing comment conceded as much:
    // "The test is not asserting that errors MUST exist."
    //
    // ContactForm is where the association pattern is real, so that is where it is
    // asserted. The /sign-in gap is filed separately rather than silently tolerated.
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await page.waitForSelector('form', { state: 'visible', timeout: 5000 });

    // Submitting empty is what creates the errors; react-hook-form is `mode: 'onSubmit'`.
    await page.locator('button[type="submit"]').click();

    const fields = ['name', 'email', 'subject', 'message'];
    const errorMessages = page.locator('[id$="-error"]');
    await expect(errorMessages).toHaveCount(fields.length);

    // Every field must be marked invalid AND point at its own message. Asserting this
    // per field, unconditionally, is the difference between this test and the guarded
    // version it replaces — there is no path through it that measures nothing.
    for (const field of fields) {
      const control = page.locator(`#${field}`);
      await expect(
        control,
        `#${field} should be marked invalid`
      ).toHaveAttribute('aria-invalid', 'true');
      // A CONTAINS check, not an equality one: aria-describedby is a space-separated
      // list, and subject/message also carry their `-help` hint (#855). Asserting
      // equality here would break the moment a field gains help text, which is a
      // change that improves accessibility — a test must not punish that.
      await expect(
        control,
        `#${field} should be described by its own error message`
      ).toHaveAttribute(
        'aria-describedby',
        new RegExp(`(^| )${field}-error( |$)`)
      );

      const message = page.locator(`#${field}-error`);
      await expect(message).toBeVisible();
      await expect(message).not.toBeEmpty();
    }
  });
});
