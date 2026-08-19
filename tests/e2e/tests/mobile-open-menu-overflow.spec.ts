/**
 * An OPEN dropdown must stay inside the viewport at every critical mobile width (#803).
 *
 * WHY THE EXISTING SWEEP CANNOT SEE THIS. `mobile-horizontal-scroll.spec.ts` visits every
 * route at `CRITICAL_MOBILE_WIDTHS` and flags any element whose right edge passes the
 * viewport. It misses open menus for two independent reasons, either sufficient alone:
 *
 *   1. It never opens anything — the sweep is goto → resize → evaluate.
 *   2. A CLOSED DaisyUI dropdown is `display: none`, so its `<ul>` and every row inside
 *      report 0x0 and are discarded by the sweep's own first guard
 *      (`if (r.width === 0 && r.height === 0) continue;`).
 *
 * The nav-width assertions elsewhere do not cover it either: `.dropdown-content` is
 * `position: absolute`, so it never contributes to `<nav>`'s bounding box.
 *
 * WHAT ACTUALLY PROTECTS 320px TODAY is a single CSS class — `max-w-[calc(100vw-4rem)]`
 * on the dropdown `<ul>` in `GlobalNav.tsx`. Nothing asserted it. Delete that one class
 * and every gate in the suite stayed green, which is what #803 reported and what this
 * spec is mutation-verified against.
 *
 * WHY TRIGGERS ARE DISCOVERED, NOT LISTED. A hardcoded list silently stops covering a
 * control that gets added, renamed or hidden — and `hidden lg:block` already removes
 * controls from every mobile gate in this repo without anything noticing. So the spec
 * finds the open-able controls at each width and asserts it found the ones that must
 * be there.
 *
 * WHAT THIS CANNOT CHECK: that the menu is USABLE at that width — only that nothing in
 * it crosses the viewport edge. Stated so a green run is not over-read.
 */
import { test, expect } from '@playwright/test';
import { CRITICAL_MOBILE_WIDTHS } from '@/config/test-viewports';

/** Controls that open a dropdown and are expected to exist at mobile widths. */
const REQUIRED_TRIGGERS = ['Navigation menu'];

test.describe('open dropdowns stay inside the viewport (#803)', () => {
  for (const width of CRITICAL_MOBILE_WIDTHS) {
    test(`no open dropdown overflows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Every visible control that owns a `.dropdown-content`, by accessible name.
      const triggers: string[] = await page.evaluate(() => {
        const names: string[] = [];
        document.querySelectorAll('[aria-label]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          const root = el.closest('.dropdown');
          if (root && root.querySelector('.dropdown-content')) {
            const name = el.getAttribute('aria-label');
            if (name && !names.includes(name)) names.push(name);
          }
        });
        return names;
      });

      // NON-VACUITY, and it is the point of the whole file. "Nothing overflowed" is
      // trivially true of a page where nothing was opened — which is precisely the
      // state the existing sweep is stuck in.
      for (const required of REQUIRED_TRIGGERS) {
        expect(
          triggers,
          `no dropdown trigger named "${required}" was found at ${width}px, so this ` +
            `test would pass without measuring the menu it exists to measure`
        ).toContain(required);
      }

      for (const name of triggers) {
        const trigger = page.locator(`[aria-label="${name}"]`).first();
        await trigger.click();

        const content = page
          .locator('.dropdown-content')
          .filter({ has: page.locator(':scope *') })
          .locator('visible=true')
          .first();
        await expect(
          content,
          `"${name}" did not open, so nothing inside it could be measured`
        ).toBeVisible({ timeout: 5000 });

        const measured = await content.evaluate((root) => {
          const vw = document.documentElement.clientWidth;
          const boxes: {
            tag: string;
            text: string;
            right: number;
            left: number;
          }[] = [];
          const all = [root, ...Array.from(root.querySelectorAll('*'))];
          for (const el of all) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            boxes.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 40),
              right: Math.round(r.x + r.width),
              left: Math.round(r.x),
            });
          }
          return { vw, boxes };
        });

        // Second non-vacuity guard: an open-but-empty container would satisfy the
        // overflow assertion while measuring nothing.
        expect(
          measured.boxes.length,
          `"${name}" opened but exposed no measurable elements`
        ).toBeGreaterThan(1);

        const overflowing = measured.boxes.filter(
          (b) => b.right > measured.vw + 1 || b.left < -1
        );
        expect(
          overflowing,
          `at ${width}px the open "${name}" dropdown puts ${overflowing.length} ` +
            `element(s) outside the ${measured.vw}px viewport: ` +
            overflowing
              .map((b) => `<${b.tag}> "${b.text}" spans ${b.left}..${b.right}`)
              .join('; ')
        ).toEqual([]);

        await page.keyboard.press('Escape');
        await trigger.blur().catch(() => {});
      }
    });
  }
});
