/**
 * An OPEN dropdown must stay inside the viewport at every critical mobile width (#803).
 *
 * WHY THE EXISTING SWEEP CANNOT SEE THIS. `mobile-horizontal-scroll.spec.ts` visits every
 * route at `CRITICAL_MOBILE_WIDTHS` and flags any element whose right edge passes the
 * viewport. It misses open menus for two independent reasons, either sufficient alone:
 *
 *   1. It never opens anything — the sweep is goto → resize → evaluate.
 *   2. A closed panel contributes nothing to measure. It used to be a DaisyUI
 *      `.dropdown-content` at `display: none`; since #1018 the header's panels are
 *      React-owned and are not in the DOM at all until opened. Either way the sweep's
 *      first guard (`if (r.width === 0 && r.height === 0) continue;`) discards them.
 *
 * The nav-width assertions elsewhere do not cover it either: an open panel is
 * `position: absolute`, so it never contributes to `<nav>`'s bounding box.
 *
 * WHAT #803 REPORTED is that a single CSS class — `max-w-[calc(100vw-4rem)]` on the
 * panel in `GlobalNav.tsx` — was the only thing keeping it inside a 320px viewport,
 * and that deleting it left every other gate in the suite green. The class is still
 * there, verbatim, and `GlobalNav.accessibility.test.tsx` now asserts its presence.
 *
 * THAT CLAIM IS STALE, and #1018 measured it rather than inheriting it. In a real
 * browser at a 320px viewport with the menu open:
 *
 *     width     160px      <- `w-40` wins the cascade
 *     max-width 256px      <- calc(100vw - 4rem), never reached
 *     panel     103..263   <- inside a 320px viewport with room to spare
 *
 * So the max-width does not bind at any width this spec runs, and `w-40` is what
 * actually keeps the panel inside the viewport today. (Both `w-40` and daisyUI's
 * `.menu { width: fit-content }` sit in `@layer utilities` at equal specificity, so
 * source order decides, and source order goes to `w-40`.) The class is kept anyway —
 * it is the backstop if the width ever becomes content-sized — and #1022 tracks the
 * stale claim.
 *
 * What this spec guarantees is the PROPERTY, not the mechanism: whatever is open,
 * nothing inside it crosses the viewport edge. Widen the panel and this goes red
 * regardless of which class was doing the work.
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

/** Controls that open a panel and are expected to exist at mobile widths. */
const REQUIRED_TRIGGERS = ['Navigation menu'];

test.describe('open menus stay inside the viewport (#803)', () => {
  for (const width of CRITICAL_MOBILE_WIDTHS) {
    test(`no open menu overflows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Every visible control that opens a panel, by accessible name.
      //
      // Discovered from the ARIA contract (`aria-expanded` on a button) rather than
      // from markup classes. The previous version keyed off `.closest('.dropdown')`,
      // which stopped matching anything the moment the header's popovers became
      // React-owned (#1018) — and because the list would then be EMPTY, the
      // non-vacuity assert below is what would have caught it. Keying off the role
      // contract instead means the next structural change does not silently empty it.
      const triggers: string[] = await page.evaluate(() => {
        const names: string[] = [];
        document
          .querySelectorAll('button[aria-expanded][aria-label]')
          .forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            const name = el.getAttribute('aria-label');
            if (name && !names.includes(name)) names.push(name);
          });
        return names;
      });

      // NON-VACUITY, and it is the point of the whole file. "Nothing overflowed" is
      // trivially true of a page where nothing was opened — which is precisely the
      // state the existing sweep is stuck in.
      for (const required of REQUIRED_TRIGGERS) {
        expect(
          triggers,
          `no panel trigger named "${required}" was found at ${width}px, so this ` +
            `test would pass without measuring the menu it exists to measure`
        ).toContain(required);
      }

      for (const name of triggers) {
        const trigger = page.locator(`button[aria-label="${name}"]`).first();

        // Retry the click until the panel actually opens. These popovers are React
        // state now, and a click dispatched before React attaches its handler is
        // silently swallowed — the same hazard mobile-touch-targets.spec.ts
        // documents measuring ("identical code passed one run and failed the next").
        await expect(async () => {
          await trigger.click();
          await expect(trigger).toHaveAttribute('aria-expanded', 'true', {
            timeout: 1000,
          });
        }).toPass({ timeout: 15000 });

        const content = page
          .locator('[data-testid^="nav-popover-"]')
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
          `at ${width}px the open "${name}" menu puts ${overflowing.length} ` +
            `element(s) outside the ${measured.vw}px viewport: ` +
            overflowing
              .map((b) => `<${b.tag}> "${b.text}" spans ${b.left}..${b.right}`)
              .join('; ')
        ).toEqual([]);

        // Escape genuinely closes these, and returns focus to the trigger. Waited
        // on rather than fired-and-forgotten, so the next iteration cannot measure
        // the previous panel.
        await page.keyboard.press('Escape');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      }
    });
  }
});
