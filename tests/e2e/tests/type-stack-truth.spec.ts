import { test, expect } from '@playwright/test';

/**
 * #377 — the declared typeface must be the rendered one.
 *
 * Geist was configured in `layout.tsx` via `next/font` for the entire life of
 * this repo and rendered on exactly zero pixels. It downloaded, self-hosted and
 * reported `status: "loaded"` in `document.fonts` the whole time. Three
 * separate things had to agree for it to paint and only one of them did.
 *
 * Every assertion here is therefore about COMPUTED STYLE, never about
 * configuration. A test that checks `next/font` was called, or that a `<link>`
 * exists, or that a face is in `document.fonts`, would have passed throughout.
 */

/** Faces declared in layout.tsx and mapped in globals.css `@theme`. */
const BODY_FACE = 'Archivo';
const DISPLAY_FACE = 'Archivo Black';
const MONO_FACE = 'JetBrains Mono';

/** First family in a computed font-family list, quotes stripped. */
const firstFamily = (stack: string) =>
  stack
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '');

test.describe('#377 type stack truth', () => {
  /**
   * T1 — the faces actually paint.
   *
   * MUTATION CHECK: revert `FONT_FAMILIES` in accessibility-tokens.ts to a
   * stack that does not lead with `var(--font-archivo)`. Verified red.
   *
   * Deliberately NOT claimed: removing the `@theme` mapping does not turn this
   * test red, and the note here originally said it did. `FONT_FAMILIES` also
   * leads with `var(--font-archivo)`, so the accessibility channel keeps body
   * and headings on the brand faces on its own. T2 and T4 are what actually
   * pin the `@theme` mapping — it is load-bearing for the `font-*` utilities,
   * for `--font-mono` in the Prism stylesheet, and for the no-JavaScript path
   * where nothing ever sets `--sh-font-body`.
   */
  test('body, headings and code render the declared faces', async ({
    page,
  }) => {
    await page.goto('/docs');

    const rendered = await page.evaluate(() => {
      const of = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).fontFamily : null;
      };
      return {
        body: getComputedStyle(document.body).fontFamily,
        heading: of('h1'),
        code: of('pre code') ?? of('code'),
      };
    });

    expect(rendered.heading, '/docs has no h1 to measure').not.toBeNull();

    expect(firstFamily(rendered.body)).toBe(BODY_FACE);
    expect(firstFamily(rendered.heading!)).toBe(DISPLAY_FACE);
    if (rendered.code) {
      expect(firstFamily(rendered.code)).toBe(MONO_FACE);
    }
  });

  /**
   * T2 — the font variables must be declared on the root element.
   *
   * This is the defect that made the first attempt at #377 fail exactly like
   * Geist. A custom property resolves in the scope where it is DECLARED, not
   * where it is used. `next/font`'s `.variable` classes were on `<body>`, one
   * level below `:root` — where `@theme` emits `--font-sans: var(--font-archivo)`
   * and where `AccessibilityScript` sets `--sh-font-body`. Both referenced a
   * variable that did not exist in their scope, silently took their
   * `ui-sans-serif` fallback, and the font downloaded perfectly while painting
   * nothing.
   *
   * MUTATION CHECK: move the three `.variable` classes back to `<body>` in
   * layout.tsx. Verified red (and T1 goes red with it).
   */
  test('font variables are declared on :root, not below it', async ({
    page,
  }) => {
    await page.goto('/docs');

    const scoped = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const names = [
        '--font-archivo',
        '--font-archivo-black',
        '--font-jetbrains',
        '--font-sans',
        '--font-mono',
        '--font-display',
      ];
      return names.map((n) => ({
        name: n,
        definedOnRoot: rootStyle.getPropertyValue(n).trim().length > 0,
      }));
    });

    const missing = scoped.filter((s) => !s.definedOnRoot).map((s) => s.name);
    expect(
      missing,
      'These custom properties are not visible at :root, so anything declared ' +
        'there that references them resolves to its fallback instead'
    ).toEqual([]);
  });

  /**
   * T3 — a font choice must move the headings too.
   *
   * #377's acceptance criterion: someone who picks OpenDyslexic or Atkinson
   * must not keep getting Archivo Black on every heading. Body and display are
   * separate channels precisely so the display face is replaceable; the bug
   * this guards is one being wired and the other left hard-pinned.
   *
   * MUTATION CHECK: in globals.css, change the h1-h6 rule to use
   * `var(--font-display)` directly instead of `var(--sh-font-display, ...)`.
   * Verified red.
   */
  test('choosing a font replaces the display face on headings', async ({
    page,
  }) => {
    await page.goto('/docs');

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const h1 = document.querySelector('h1');
      const read = () => ({
        body: getComputedStyle(document.body).fontFamily,
        heading: h1 ? getComputedStyle(h1).fontFamily : '',
      });

      const before = read();
      // The same pair of writes both font controls make.
      const chosen = '"OpenDyslexic", sans-serif';
      root.style.setProperty('--sh-font-body', chosen);
      root.style.setProperty('--sh-font-display', chosen);
      const after = read();

      root.style.removeProperty('--sh-font-body');
      root.style.removeProperty('--sh-font-display');
      return { before, after, restored: read() };
    });

    expect(firstFamily(result.before.heading)).toBe(DISPLAY_FACE);
    expect(firstFamily(result.after.body)).toBe('OpenDyslexic');
    expect(
      firstFamily(result.after.heading),
      'The heading kept the brand display face after the user chose another font'
    ).toBe('OpenDyslexic');
    // Clearing the choice must fall back to the design default, not stick.
    expect(firstFamily(result.restored.heading)).toBe(DISPLAY_FACE);
  });

  /**
   * T4 — the heading rule must not outrank Tailwind utilities.
   *
   * globals.css is unlayered, so a bare `h1 { font-family }` written at the top
   * level would beat every `font-*` utility and freeze headings site-wide. That
   * is the same cascade mistake as the `.text-*{…!important}` block deleted in
   * #388, which froze ~42 responsive ladders. The rule lives in `@layer base`
   * so utilities still win.
   *
   * `font-mono` is used deliberately: it is referenced by an `@apply` in
   * globals.css, so Tailwind definitely emits it. A class no source file
   * mentions is tree-shaken away and would make this pass for the wrong reason.
   *
   * MUTATION CHECK: move the h1-h6 rule out of `@layer base`. Verified red.
   */
  test('font utilities still override the base heading rule', async ({
    page,
  }) => {
    await page.goto('/docs');

    const rendered = await page.evaluate(() => {
      const el = document.createElement('h1');
      el.className = 'font-mono';
      document.body.appendChild(el);
      const withUtility = getComputedStyle(el).fontFamily;
      el.className = '';
      const bare = getComputedStyle(el).fontFamily;
      el.remove();
      return { withUtility, bare };
    });

    expect(firstFamily(rendered.bare)).toBe(DISPLAY_FACE);
    expect(
      firstFamily(rendered.withUtility),
      'An h1 carrying font-mono lost to the base heading rule — globals.css is ' +
        'unlayered, so this rule has escaped @layer base'
    ).toBe(MONO_FACE);
  });

  /**
   * T5 — the display face must be right at first paint.
   *
   * #388 established that settings applied in a mount effect re-typeset the
   * page on hydration. `--sh-font-display` is new in #377 and has to be written
   * by the same pre-paint script, or headings flash the default face.
   *
   * MUTATION CHECK: remove the `--sh-font-display` write from
   * AccessibilityScript.tsx. Verified red.
   */
  test('a stored font preference applies to headings before hydration', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          'cookie-consent',
          JSON.stringify({
            necessary: true,
            functional: true,
            analytics: false,
            marketing: false,
          })
        );
        localStorage.setItem('fontFamily', 'serif');
      } catch {
        /* storage unavailable */
      }
    });

    await page.goto('/docs', { waitUntil: 'domcontentloaded' });

    // Read before React hydrates — the pre-paint script is the only thing that
    // could have set this yet.
    const display = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--sh-font-display')
    );

    expect(
      display,
      'The pre-paint script did not set the display face, so headings will ' +
        'flash Archivo Black before switching to the stored preference'
    ).toContain('serif');
  });
});
