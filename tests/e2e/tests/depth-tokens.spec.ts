import { test, expect } from '@playwright/test';

/**
 * #377 — the Machine Shop depth system must read as depth on all 32 themes.
 *
 * The design was authored dark-only against literal `rgba(0,0,0,.8-.9)`. The
 * risk this file exists to catch is a depth system that looks right on the two
 * ScriptHammer themes and is invisible or inverted on the other thirty.
 *
 * WHY THE ASSERTION IS "EITHER INK", NOT "BOTH INKS".
 * Measured across every registered theme, base-100 lightness spans the whole
 * range: `black` sits at L=0 and ten themes sit at L=1. A shadow has no room
 * to darken at L=0; a highlight has no room to lighten at L=1. So requiring
 * both inks to be visible everywhere would be requiring the impossible, and
 * requiring only the shadow would pass on light themes while `black` rendered
 * perfectly flat. The real invariant is that AT LEAST ONE ink separates from
 * the surface on every theme.
 */

/** Every theme registered in the `@plugin "daisyui"` block in globals.css. */
const THEMES = [
  'scripthammer-dark',
  'scripthammer-light',
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
];

/**
 * Minimum OKLCH lightness separation for an ink to count as visible.
 *
 * Calibrated against measurement, not taste: the weakest theme still clears
 * 0.42 on its surviving ink, and the two dead ends measure exactly 0.00 and
 * 0.02. Anything in that gap distinguishes "working" from "flat", so 0.15
 * sits well clear of both sides.
 */
const MIN_SEPARATION = 0.15;

/**
 * The three primitive names, assembled at runtime rather than written out.
 *
 * This is deliberate and load-bearing. Tailwind's source scanner is a lexer
 * over project files and it scans `tests/` — so a spec containing the literal
 * text of a utility's name is itself enough to make Tailwind emit it. Written
 * the obvious way, T3 below passed with its own `@source inline(...)` deleted:
 * the test was manufacturing the evidence it then went looking for.
 *
 * Splitting the token keeps the literal out of the file, so T3 depends on the
 * `@source inline(...)` in globals.css and nothing else. Verified by mutation.
 */
const STEM = 'sh' + '-';
const NAMES = [STEM + 'plate', STEM + 'well', STEM + 'groove'];
const PRIMITIVES = NAMES.map((n) => `--${n}`);

test.describe('#377 depth tokens', () => {
  /**
   * T1 — every theme gets usable depth.
   *
   * MUTATION CHECK: in `globals.css`, replace the `--sh-ink-edge` ramp with a
   * fixed `transparent`. `black` (L=0) then has neither ink and this fails.
   * Symmetrically, fixing `--sh-ink-shadow` to `transparent` fails on
   * `wireframe`/`light`/`lofi` (L=1). Verified both directions.
   */
  test('every theme renders depth with at least one visible ink', async ({
    page,
  }) => {
    await page.goto('/');

    const results = await page.evaluate(
      ({ themes }) => {
        const root = document.documentElement;
        const body = document.body;
        // `data-theme` is set on BOTH html and body. A probe parented to body
        // keeps body's theme and silently reports the same values for all 32
        // themes — a sweep that looks thorough and measures one theme.
        const probe = document.createElement('div');
        root.appendChild(probe);

        const lightnessOf = (value: string): number | null => {
          probe.style.color = value;
          const m = /oklch\(([\d.]+)/.exec(getComputedStyle(probe).color);
          probe.style.color = '';
          return m ? Number(m[1]) : null;
        };

        const rows = themes.map((theme) => {
          root.setAttribute('data-theme', theme);
          body.setAttribute('data-theme', theme);

          const surface = lightnessOf(
            'oklch(from var(--color-base-100) l c h)'
          );
          const shadow = lightnessOf('var(--sh-ink-shadow)');
          const edge = lightnessOf('var(--sh-ink-edge)');

          return {
            theme,
            surface,
            // Signed on purpose: a shadow must be DARKER and an edge LIGHTER.
            // Using absolute values here would let an inverted system pass.
            shadowSeparation:
              surface !== null && shadow !== null ? surface - shadow : null,
            edgeSeparation:
              surface !== null && edge !== null ? edge - surface : null,
          };
        });

        probe.remove();
        return rows;
      },
      { themes: THEMES }
    );

    const flat = results.filter(
      (r) =>
        (r.shadowSeparation ?? 0) < MIN_SEPARATION &&
        (r.edgeSeparation ?? 0) < MIN_SEPARATION
    );

    expect(
      flat,
      `These themes render flat — neither ink separates from the surface by ${MIN_SEPARATION}:\n` +
        flat
          .map(
            (r) =>
              `  ${r.theme}: surface L=${r.surface}, shadow=${r.shadowSeparation?.toFixed(3)}, edge=${r.edgeSeparation?.toFixed(3)}`
          )
          .join('\n')
    ).toEqual([]);

    // Guard the guard: if the sweep stopped switching themes it would report
    // one theme 34 times and pass. Distinct surface lightnesses prove it moved.
    const distinctSurfaces = new Set(results.map((r) => r.surface));
    expect(
      distinctSurfaces.size,
      'The theme sweep did not actually switch themes'
    ).toBeGreaterThan(10);
  });

  /**
   * T2 — the primitives must be theme-derived, never literal black.
   *
   * #377's acceptance criterion. A literal `rgba(0,0,0,…)` is the exact defect
   * this system was rebuilt to avoid: invisible on dark themes, and a grey
   * bruise on the warm light ones because it carries no hue.
   *
   * MUTATION CHECK: change `--sh-ink-shadow` to `rgba(0, 0, 0, 0.55)`.
   */
  test('depth primitives derive from theme colour, not literal black', async ({
    page,
  }) => {
    await page.goto('/');

    const offenders = await page.evaluate(
      ({ primitives }) => {
        const cs = getComputedStyle(document.documentElement);
        return primitives
          .map((name) => ({ name, value: cs.getPropertyValue(name).trim() }))
          .filter(
            ({ value }) =>
              // A computed literal black resolves to rgba(0,0,0,a) or oklch(0 0 0…)
              /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/.test(value) ||
              /oklch\(\s*0\s+0\s+0/.test(value)
          );
      },
      { primitives: [...PRIMITIVES] }
    );

    expect(
      offenders,
      'Depth primitives must be derived from the theme surface, not literal black'
    ).toEqual([]);
  });

  /**
   * T4 — a raised plate and a cut well must not resolve to the same thing.
   *
   * The gate that was missing. T1–T3 all passed while `--sh-plate` and
   * `--sh-well` were near-indistinguishable in use: the authored recipe gave
   * the well a big OUTER drop plus a 1px inner lip, so on every theme both
   * primitives resolved to "outer drop + one inset line" and differed only by
   * blur radius. Every existing assertion was happy — the tokens were
   * theme-derived, visible, and emitted. They were just not opposites.
   *
   * Caught by applying them to a real page (#380) and looking, which is the
   * same way the icon defects were caught. Encoded here so it cannot recur:
   * the two are physically inverse, so their SHADOW STRUCTURE must invert too.
   *
   *   plate → outer-dominant (raised: casts down onto the page)
   *   well  → inset-dominant (cut: shadow falls inside its own top edge)
   *
   * MUTATION CHECK: restore the old value —
   * `--sh-well: 0 22px 42px -16px var(--sh-ink-shadow), inset 0 1px 0 var(--sh-ink-edge)`.
   * The well then has one outer and one inset layer, and this fails.
   */
  test('a plate reads as raised and a well as cut, on every theme', async ({
    page,
  }) => {
    await page.goto('/');

    const rows = await page.evaluate(
      ({ themes, names }) => {
        const root = document.documentElement;
        const body = document.body;
        const probe = document.createElement('div');
        root.appendChild(probe);
        const layers = (cls: string) => {
          probe.className = cls;
          const s = getComputedStyle(probe).boxShadow;
          // Split on commas that separate layers, not those inside colour fns.
          const parts = s.split(/,(?![^(]*\))/);
          const inset = parts.filter((p) => p.includes('inset')).length;
          return { inset, outer: parts.length - inset };
        };
        const out = themes.map((t) => {
          root.setAttribute('data-theme', t);
          body.setAttribute('data-theme', t);
          return { theme: t, plate: layers(names[0]), well: layers(names[1]) };
        });
        probe.remove();
        return out;
      },
      { themes: THEMES, names: NAMES }
    );

    const wrong = rows.filter(
      (r) => !(r.plate.outer > r.plate.inset) || !(r.well.inset > r.well.outer)
    );

    expect(
      wrong,
      'A plate must be outer-dominant and a well inset-dominant, or the two ' +
        'read as the same surface:\n' +
        wrong
          .map(
            (r) =>
              `  ${r.theme}: plate ${r.plate.outer} outer/${r.plate.inset} inset, ` +
              `well ${r.well.outer} outer/${r.well.inset} inset`
          )
          .join('\n')
    ).toEqual([]);
  });

  /**
   * T3 — the utilities must actually compile.
   *
   * Tailwind only emits a `@utility` it can see used in scanned source. These
   * three ship ahead of the page tickets that consume them (#379-#384), so
   * without the `@source inline(...)` in globals.css they compile to nothing
   * and every consumer silently gets no shadow.
   *
   * MUTATION CHECK: delete the `@source inline(...)` line from globals.css.
   * All three assertions fail. (They did NOT, until the class names were kept
   * out of this file's source text — see the NAMES comment above.)
   */
  test('the three depth utilities are emitted', async ({ page }) => {
    await page.goto('/');

    const emitted = await page.evaluate((names: string[]) => {
      const probe = document.createElement('div');
      document.documentElement.appendChild(probe);
      const out: Record<string, string> = {};
      for (const cls of names) {
        probe.className = cls;
        out[cls] = getComputedStyle(probe).boxShadow;
      }
      probe.remove();
      return out;
    }, NAMES);

    for (const cls of NAMES) {
      expect(
        emitted[cls],
        `.${cls} compiled to no box-shadow — Tailwind tree-shook it`
      ).not.toBe('none');
      expect(emitted[cls]).toContain('oklch');
    }
  });
});
