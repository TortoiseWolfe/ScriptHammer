import { test, expect } from '@playwright/test';

/**
 * #305 — colorblind mode must not un-fix the page.
 *
 * WHY THIS SPEC EXISTS, AND WHY IT CANNOT BE A UNIT TEST.
 *
 * `useColorblindMode` used to do `body.style.filter = 'url(#protanopia)'`. A
 * `filter` other than `none` makes its element a CONTAINING BLOCK for
 * `position: fixed` descendants — the CSS Filter Effects spec exempts only the
 * ROOT element, and <body> is not the root. So enabling the accessibility
 * feature silently anchored every fixed element to <body> and made it scroll
 * with the document: the atlas tour caption (which PR #297 moved to `fixed`
 * precisely to rescue it), the diorama shell, the cookie banner, /messages.
 *
 * The hook's 8 unit tests all asserted `expect(document.body.style.filter)
 * .toBe('url(#tritanopia)')` — i.e. that the property was SET. A
 * containing-block change is a LAYOUT fact, and jsdom has no layout, so those
 * tests passed for the entire life of the bug. That is this repo's recorded
 * trap in a fourth costume: the assertion is green while the user's screen is
 * wrong. Measuring real geometry in a real browser is the only honest check.
 *
 * The probe element is deliberate rather than reaching for an app element:
 * what is under test is the CONTAINING BLOCK the app's own CSS establishes,
 * and a probe measures exactly that with nothing else in the way.
 */

const STORAGE_KEY = 'colorblind-settings'; // src/utils/colorblind.ts:105

test.describe('#305 colorblind mode vs position:fixed', () => {
  test('a fixed element stays viewport-anchored on a scrolled page', async ({
    page,
  }) => {
    await page.addInitScript(
      ([key]) => {
        localStorage.setItem(
          key,
          JSON.stringify({ mode: 'protanopia', patternsEnabled: false })
        );
      },
      [STORAGE_KEY]
    );

    await page.goto('/');

    // Wait for the hook's mount effect to apply the filter ANYWHERE — <html>
    // or <body>. Polling for it on <html> specifically would make this spec
    // fail on the old code for a tautological reason ("you didn't move it"),
    // never exercising the geometry. The bug is not where the filter is; the
    // bug is that fixed elements stop being fixed. This precondition must pass
    // on the BUGGY code so the assertion below is what fails.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              getComputedStyle(document.documentElement).filter !== 'none' ||
              getComputedStyle(document.body).filter !== 'none'
          ),
        { message: 'colorblind filter should be applied somewhere' }
      )
      .toBe(true);

    const result = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;top:64px;left:0;right:0;bottom:0;pointer-events:none;';
      document.body.appendChild(probe);
      const at = () => Math.round(probe.getBoundingClientRect().top);

      window.scrollTo(0, 0);
      const unscrolled = at();
      window.scrollTo(0, 150);
      const scrolled = at();
      const scrollY = Math.round(window.scrollY);

      probe.remove();
      window.scrollTo(0, 0);
      return {
        unscrolled,
        scrolled,
        scrollY,
        bodyFilter: document.body.style.filter,
        pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
      };
    });

    // Guard: if this page can't scroll, the test proves nothing — the bug is
    // invisible when body height == viewport (body's padding box IS the
    // viewport then, so there is no offset to diverge). That coincidence is
    // what let this hide, so a non-scrolling page must fail loudly, not pass.
    expect(
      result.pageScrolls,
      'test page must scroll or this proves nothing'
    ).toBe(true);
    expect(result.scrollY, 'page must have actually scrolled').toBeGreaterThan(
      0
    );

    // The actual assertion: `fixed` means fixed. Before the fix this read 64
    // unscrolled and -86 scrolled.
    expect(result.scrolled).toBe(result.unscrolled);

    // And the root cause itself, stated directly.
    expect(result.bodyFilter, '<body> must never carry the filter').toBe('');
  });
});
