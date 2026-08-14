import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AAA contrast for the cod-skeleton HUD chrome (#715).
 *
 * WHY THIS SPEC EXISTS. `/game/cod-skeleton` is excluded from the route-sweeping
 * `color-contrast.spec.ts` because it runs a continuous WebGL loop and, on a GPU-less
 * runner, compositing that canvas goes through a synchronous GPU readback — traced at
 * `GLES2::ReadPixels` 10.7s inside a 13s window (#719). The sweep's readiness wait cannot
 * settle there at any timeout. That exclusion left the page's contrast genuinely unmeasured,
 * and this pays the debt. It is the same move `/chatt` made toward
 * `twin-glass-contrast.spec.ts`, whose technique this borrows wholesale.
 *
 * THE ONE QUESTION. The HUD is three chips — the stance badge, the quality `<select>` and
 * the controls hint — and all three are the same pairing: `text-base-content` on
 * `bg-base-300/90`, floating over an arbitrary WebGL scene. A translucent surface over an
 * unconstrained backdrop, which is exactly the twin glass-nav problem. `/70` is what shipped
 * before this spec measured it: 5.00:1 light, 4.51:1 dark, both under the 7:1 gate.
 *
 * WHY NOT THE OBVIOUS APPROACHES, each of which passes while measuring nothing:
 *
 *  - **jsdom + axe `color-contrast`** — DaisyUI's stylesheet never applies in jsdom, so the
 *    tokens resolve to nothing and the node lands in `incomplete`, which
 *    `toHaveNoViolations()` ignores. Three tests in this repo already ship green having
 *    never measured a ratio.
 *  - **Loading the real route** — reintroduces the #719 freeze this exclusion exists to
 *    avoid.
 *  - **Disabling WebGL for a cheap DOM** — `CodSkeleton.tsx:395` then returns
 *    `FallbackPanel` and you would measure `bg-base-200` while reporting HUD coverage.
 *  - **Hand-computing the alpha blend** — Tailwind v4 emits `bg-base-300/70` as
 *    `color-mix(in oklab, …)`. Recomputing that in sRGB measures a colour the browser never
 *    paints; the documented version of this trap read a real 4.13:1 as 1.03:1.
 *
 * SO: inject the real utility classes on a cheap non-WebGL route, let the browser resolve
 * them, and read the result back through a 1x1 canvas — the only way OKLCH and `color-mix`
 * become sRGB correctly. Then bracket the unconstrained scene between black and white.
 */

const AAA = 7;
const THEMES = ['scripthammer-light', 'scripthammer-dark'] as const;

/** The classes the HUD actually ships. Kept as data so the source guard can check them. */
const HUD_SURFACE = 'bg-base-300/90';
const HUD_TEXT = 'text-base-content';
/** Stance badge, quality select, controls hint (CodSkeleton.tsx :426, :436, :448). */
const HUD_CHIP_COUNT = 3;

const COD_SKELETON_SRC = join(
  process.cwd(),
  'src',
  'components',
  'game',
  'CodSkeleton',
  'CodSkeleton.tsx'
);

test.describe('cod-skeleton HUD contrast over an arbitrary scene (#715)', () => {
  /**
   * GUARD 3 of 4 — the source-literal guard.
   *
   * This spec measures a class string it injects itself, so if the HUD is restyled it would
   * happily keep measuring a combination nothing renders, forever green. Anchoring to the
   * component source is what stops that. The alternative — extracting the HUD into its own
   * component with one exported class constant that both sides import, leaving no string
   * matching to defeat — is better and larger; noted in #715.
   */
  test('the classes this spec measures are the classes the HUD ships', () => {
    const src = readFileSync(COD_SKELETON_SRC, 'utf8');

    // TOKENS, NOT SUBSTRINGS, and every string literal rather than `className` lines.
    //
    // Both choices are load-bearing and both were wrong in the first version:
    //   - `line.includes('text-base-content')` is satisfied by `text-base-content/70`,
    //     which is the exact AAA regression this guard exists to catch (#411 is the same
    //     family: /60 and /70 text failing the 7:1 gate). A substring test cannot tell a
    //     class from its own dimmed variant.
    //   - matching on `className` lines misses a class hoisted into a const, which is an
    //     ordinary refactor. Scanning literals covers inline and hoisted alike.
    // COMMENTS STRIPPED FIRST. The chips carry an explanatory comment that names
    // `bg-base-300/90` in backticks, and scanning raw source counted it as a fourth chip —
    // caught immediately, because the count assertion below went 3 → 4 on the untouched
    // tree. The predecessor of this guard hit the same wall and documented it: "a guard
    // that fires on prose is a guard that will be deleted by the next person it annoys."
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '') // block + JSX comments
      .replace(/^\s*\/\/.*$/gm, ''); // whole-line comments (not `https://` inside strings)
    const literals = [...code.matchAll(/["'`]([^"'`\n]*)["'`]/g)].map(
      (m) => m[1]
    );
    const tokens = (s: string) => s.split(/\s+/).filter(Boolean);

    // GUARD 3a — nothing translucent may exist that this spec is not measuring.
    //
    // Inverted on purpose. Counting the ONE class we know about is silent about a FOURTH
    // chip added on a different surface — an FPS counter on `bg-base-100/60` would fail
    // AAA over the same unconstrained scene and every assertion here would still pass.
    // Asserting the SET makes a new surface a hard failure that names itself.
    const translucent = new Set(
      literals
        .flatMap(tokens)
        .filter((t) => /^bg-[\w-]+\/(\[[^\]]+\]|\d+)$/.test(t))
    );
    expect(
      [...translucent].sort(),
      `CodSkeleton.tsx has a translucent surface this spec does not measure. Every ` +
        `bg-*/<alpha> floating over the WebGL scene needs bracketing — add it to ` +
        `HUD_SURFACE and measure it rather than widening this assertion`
    ).toEqual([HUD_SURFACE]);

    // GUARD 3b — the chips carry the exact text token, not a dimmed variant of it.
    const chips = literals.filter((l) => tokens(l).includes(HUD_SURFACE));
    expect(
      chips.length,
      `expected ${HUD_CHIP_COUNT} HUD chips carrying "${HUD_SURFACE}", found ` +
        `${chips.length}. If a chip was added or restyled, measure it here rather than ` +
        `moving this number`
    ).toBe(HUD_CHIP_COUNT);
    for (const chip of chips) {
      expect(
        tokens(chip),
        `a HUD chip pairs ${HUD_SURFACE} with something other than exactly ` +
          `"${HUD_TEXT}" — a dimmed variant like ${HUD_TEXT}/70 drops the measured ` +
          `ratio well under 7:1 while this spec keeps reporting the undimmed number`
      ).toContain(HUD_TEXT);
    }
  });

  for (const theme of THEMES) {
    test(`${theme} — HUD chrome clears AAA over both a black and a white scene`, async ({
      page,
    }) => {
      // Seeded before any script runs, so the inline theme bootstrap picks it up rather
      // than falling back to prefers-color-scheme.
      await page.addInitScript(
        (t) => window.localStorage.setItem('theme', t),
        theme
      );

      // THE ROUTE'S STYLESHEET, WITHOUT THE ROUTE'S CANVAS.
      //
      // The first version of this spec probed on `/themes/` — a cheap non-WebGL page — and
      // the alpha guard immediately caught it measuring `rgba(0, 0, 0, 0)`. Next.js splits
      // CSS per route, so `bg-base-300/70` ships only in the chunk for the route that uses
      // it (verified: 1 hit, in one CSS file, none in the others). A probe on any other
      // page is styling itself with a rule the browser never loaded.
      //
      // So load `/game/cod-skeleton` for its stylesheet, and deny WebGL first. The
      // component's own `isWebGLAvailable()` check (CodSkeleton.tsx:354) then returns
      // false, it early-returns `FallbackPanel`, and no `WebGLRenderer` is ever
      // constructed — so #719's readback freeze cannot occur. `2d` is left intact,
      // because the composite below depends on it.
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...rest: unknown[]
        ) {
          if (/webgl/i.test(type)) return null;
          return (
            original as unknown as (
              t: string,
              ...r: unknown[]
            ) => RenderingContext | null
          ).call(this, type, ...rest);
        } as typeof HTMLCanvasElement.prototype.getContext;
      });

      await page.goto('/game/cod-skeleton/');

      // GUARD 4 — the WebGL denial actually took.
      //
      // The monkey-patch above is the only thing keeping this spec clear of #719: if it
      // stops covering the path R3F uses to acquire a context (an OffscreenCanvas probe, a
      // different `isWebGLAvailable` implementation), a real WebGLRenderer gets constructed
      // on a GPU-less runner and this spec inherits the synchronous-readback freeze that got
      // the route excluded from color-contrast.spec.ts in the first place. Without this
      // assertion that arrives as an opaque 30s timeout; with it, it says what happened.
      await expect(
        page.locator('[data-webgl-ok="false"]'),
        'WebGL was not actually denied — the component built a real renderer, so this ' +
          'spec is now exposed to the #719 readback freeze it was written to avoid'
      ).toBeVisible();

      const result = await page.evaluate(
        ({ surface, text }) => {
          // Inject the real utilities and let the browser resolve them. Reading
          // `getComputedStyle` off a hand-written rgba() would measure our arithmetic
          // instead of the product's.
          const probe = document.createElement('div');
          probe.className = `${surface} ${text}`;
          probe.textContent = 'STAND';
          document.body.appendChild(probe);

          const styles = getComputedStyle(probe);
          const surfaceColor = styles.backgroundColor;
          const textColor = styles.color;

          // Token sanity, read from :root rather than the probe.
          const root = getComputedStyle(document.documentElement);
          const base300 = root.getPropertyValue('--color-base-300').trim();
          const baseContent = root
            .getPropertyValue('--color-base-content')
            .trim();

          const cv = document.createElement('canvas');
          cv.width = cv.height = 1;
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          if (!ctx) return { error: 'no 2d context' };

          // Paint `under`, then `over`, and read back what was actually painted. This is
          // where OKLCH and color-mix become sRGB correctly.
          const composite = (under: string, over: string) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = under;
            ctx.fillRect(0, 0, 1, 1);
            ctx.fillStyle = over;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            return [r, g, b] as [number, number, number];
          };
          const lum = ([r, g, b]: [number, number, number]) => {
            const f = (c: number) => {
              const s = c / 255;
              return s <= 0.03928
                ? s / 12.92
                : Math.pow((s + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const ratio = (a: number, b: number) =>
            (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

          // Text is opaque, so it composites identically over either backdrop — still run
          // it through the canvas so OKLCH is converted rather than parsed.
          const lText = lum(composite('#808080', textColor));
          const overBlack = lum(composite('#000000', surfaceColor));
          const overWhite = lum(composite('#ffffff', surfaceColor));

          const alpha = (() => {
            const m =
              surfaceColor.match(/\/\s*([\d.]+)\s*\)/) ||
              surfaceColor.match(/,\s*([\d.]+)\s*\)$/);
            return m ? parseFloat(m[1]) : 1;
          })();

          probe.remove();
          return {
            surfaceColor,
            textColor,
            base300,
            baseContent,
            alpha,
            ratioOverBlackScene: ratio(lText, overBlack),
            ratioOverWhiteScene: ratio(lText, overWhite),
            signOverBlack: Math.sign(lText - overBlack),
            signOverWhite: Math.sign(lText - overWhite),
          };
        },
        { surface: HUD_SURFACE, text: HUD_TEXT }
      );

      expect(result.error).toBeUndefined();

      // GUARD 1 of 3 — the surface must actually be translucent. If `bg-base-300/70` ever
      // leaves the compiled CSS, `backgroundColor` becomes rgba(0,0,0,0), the composite
      // equals the backdrop, and every assertion below sails through measuring nothing.
      expect(
        result.surfaceColor,
        'the HUD surface resolved to fully transparent — the utility is not in the ' +
          'compiled CSS and this spec is measuring the page background'
      ).not.toBe('rgba(0, 0, 0, 0)');
      expect(
        result.alpha,
        'the HUD surface is opaque here; that has superb contrast and proves nothing ' +
          'about the translucent chrome that ships'
      ).toBeLessThan(1);

      // GUARD 2 of 3 — the theme tokens must have resolved. In an environment where the
      // stylesheet has not applied, both read empty/grey and everything passes.
      expect(
        result.base300,
        `--color-base-300 did not resolve under ${theme}`
      ).not.toBe('');
      expect(result.baseContent).not.toBe('');
      expect(
        result.base300,
        'base-300 and base-content resolved to the same value — the theme did not apply'
      ).not.toBe(result.baseContent);

      // The bracket is only a proof if the luminance order holds at both ends. If it
      // flipped, the worst case would be somewhere in the interior, at 1:1.
      expect(
        result.signOverBlack,
        'text/surface luminance order flips between a black and a white scene, so the ' +
          'two endpoints do not bound the interior — the bracket proves nothing here'
      ).toBe(result.signOverWhite);

      // Narrow the union rather than assert past it: the evaluate() can return `{ error }`,
      // and a non-null assertion here would turn a genuine "no 2d context" into a confusing
      // `undefined.toFixed` further down.
      const black = result.ratioOverBlackScene;
      const white = result.ratioOverWhiteScene;
      expect(
        typeof black === 'number' && typeof white === 'number',
        'the probe returned no ratios — the measurement did not run'
      ).toBe(true);
      if (typeof black !== 'number' || typeof white !== 'number') return;

      const detail =
        `${theme}: text ${result.textColor} on ${result.surfaceColor} ` +
        `(alpha ${result.alpha}) — over black ${black.toFixed(2)}:1, ` +
        `over white ${white.toFixed(2)}:1, need ${AAA}:1`;
      console.log(`[cod-hud-contrast] ${detail}`);

      // The scene is unconstrained, so both endpoints must clear the gate.
      expect(result.ratioOverBlackScene, detail).toBeGreaterThanOrEqual(AAA);
      expect(result.ratioOverWhiteScene, detail).toBeGreaterThanOrEqual(AAA);
    });
  }
});
