import { test, expect } from '@playwright/test';

/**
 * #373 §A1 — `container` must fill the viewport, not the previous breakpoint.
 *
 * Tailwind 4 generates `container`'s max-width ladder from the registered
 * `@theme` breakpoints. This project's ladder is deliberately narrow and
 * mobile-first (`xs` 320, `sm` 430, `md` 768…), which is correct for what
 * breakpoints are for — but `container` reused it as a content cap, so
 * between tiers content was pinned to the LOWER value and the remainder
 * became dead gutter. At 767px that was 337px, **43.9% of the screen**.
 *
 * Why no existing test caught it: a clamped container does not overflow, does
 * not clip, and does not change any accessible name. It is simply narrower
 * than it should be, and nothing asserted a lower bound on width. Every
 * layout gate in this repo checks that content does not exceed its bounds —
 * this is the mirror case, and it went unnoticed for the life of the project.
 */

/** Deliberately includes the exact tier boundaries and the worst case. */
const WIDTHS = [320, 375, 390, 428, 429, 600, 767, 1023, 1280, 1440];

/** `--breakpoint-xl`, and the cap the utility sets. */
const CAP = 1280;

/**
 * Assembled at runtime. Tailwind's scanner reads `tests/`, so the literal
 * class name in a spec is enough to make Tailwind emit that class — which is
 * how an earlier gate in this repo passed while testing nothing (#396,
 * instance 8). `container` is a core utility and would be emitted anyway, but
 * the habit is the point: never let the test be the reason the thing exists.
 */
const CLS = 'contai' + 'ner';

test.describe('#373 container width', () => {
  /**
   * MUTATION CHECK: delete the `@utility container { … }` block from
   * globals.css. Tailwind's generated ladder returns and this fails at 375,
   * 390, 428, 429, 600, 767 and 1023 — every width between two tiers.
   */
  test('container fills the viewport at every width below the cap', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    const rows = [];
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      rows.push(
        await page.evaluate(
          ({ cls, cap }) => {
            const probe = document.createElement('div');
            probe.className = cls;
            document.body.appendChild(probe);
            const width = Math.round(probe.getBoundingClientRect().width);
            probe.remove();
            const expected = Math.min(window.innerWidth, cap);
            return {
              viewport: window.innerWidth,
              width,
              expected,
              wasted: expected - width,
            };
          },
          { cls: CLS, cap: CAP }
        )
      );
    }

    // 1px of rounding slack; the failures this guards against are 55-337px.
    const clamped = rows.filter((r) => r.wasted > 1);

    expect(
      clamped,
      'container is capped below the viewport — the breakpoint ladder is ' +
        'being used as a content cap again:\n' +
        clamped
          .map(
            (r) =>
              `  ${r.viewport}px viewport -> ${r.width}px container, ` +
              `${r.wasted}px wasted (${((r.wasted / r.viewport) * 100).toFixed(1)}%)`
          )
          .join('\n')
    ).toEqual([]);
  });

  /**
   * The cap itself still has to hold, or "fills the viewport" would be
   * satisfied by having no maximum at all and line lengths would run away on
   * a wide monitor.
   *
   * MUTATION CHECK: remove `max-width` from the `@utility` block. This fails
   * at 1440 (container 1440, expected 1280).
   */
  test('container stops widening at the cap', async ({ page }) => {
    await page.goto('/sign-in');
    await page.setViewportSize({ width: 1920, height: 900 });

    const width = await page.evaluate((cls) => {
      const probe = document.createElement('div');
      probe.className = cls;
      document.body.appendChild(probe);
      const w = Math.round(probe.getBoundingClientRect().width);
      probe.remove();
      return w;
    }, CLS);

    expect(width, `container should cap at ${CAP}px on a 1920px viewport`).toBe(
      CAP
    );
  });

  /**
   * Widening the frame must not push anything off-screen. This is the
   * complement of the first test: together they pin the container to exactly
   * the viewport, from neither side.
   */
  test('widening the container introduces no horizontal overflow', async ({
    page,
  }) => {
    const routes = ['/', '/sign-in', '/blog', '/docs'];
    const bad: string[] = [];

    for (const route of routes) {
      await page.goto(route);
      for (const w of [320, 428, 767, 1023]) {
        await page.setViewportSize({ width: w, height: 900 });
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        if (over > 1) bad.push(`${route} @ ${w}px overflows by ${over}px`);
      }
    }

    expect(bad, bad.join('\n')).toEqual([]);
  });
});
