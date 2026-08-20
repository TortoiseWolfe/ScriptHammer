import { test, expect } from '@playwright/test';
import { THEMES } from '@/config/themes';

/**
 * #377 — the Machine Shop depth system must read as depth on every registered theme.
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
   * T5 — a depth utility must WIN on a real element, not just resolve.
   *
   * T1–T4 all read the tokens off a bare probe. That proves the values are
   * right; it proves nothing about whether they survive the cascade on an
   * actual component.
   *
   * They did not. `[data-theme='…'] .card` in globals.css is specificity
   * 0,2,0 and a Tailwind `@utility` is 0,1,0, so on the two DEFAULT themes a
   * card carrying `sh-plate` rendered the legacy literal-black shadow
   * instead — the exact thing the depth system replaces, winning on the only
   * two themes most people see. Found by applying it to the home page (#379).
   *
   * MUTATION CHECK: drop the `:not(.sh-plate):not(.sh-well):not(.sh-groove)`
   * chain from that block. This fails on both ScriptHammer themes, reporting
   * a literal-black shadow on the migrated element.
   */
  test('a depth utility beats component styles on the default themes', async ({
    page,
  }) => {
    await page.goto('/');

    const results = await page.evaluate(
      ({ themes, plateCls }) => {
        const root = document.documentElement;
        const body = document.body;
        // A real DaisyUI card, not a bare probe — the point is the cascade.
        const el = document.createElement('div');
        el.className = `card ${plateCls}`;
        body.appendChild(el);

        const out = themes.map((t) => {
          root.setAttribute('data-theme', t);
          body.setAttribute('data-theme', t);
          const s = getComputedStyle(el).boxShadow;
          const parts = s.split(/,(?![^(]*\))/);
          const inset = parts.filter((p) => p.includes('inset')).length;
          return {
            theme: t,
            literalBlack: /rgba?\(\s*0,\s*0,\s*0/.test(s),
            outer: parts.length - inset,
            inset,
          };
        });
        el.remove();
        return out;
      },
      {
        themes: ['scripthammer-dark', 'scripthammer-light'],
        plateCls: NAMES[0],
      }
    );

    const beaten = results.filter((r) => r.literalBlack || r.inset === 0);

    expect(
      beaten,
      'A card carrying the plate utility is rendering something else — a ' +
        'component rule is out-specifying the depth system:\n' +
        beaten
          .map(
            (r) =>
              `  ${r.theme}: ${r.outer} outer/${r.inset} inset, literalBlack=${r.literalBlack}`
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
  /**
   * T5 — a button must visibly change on hover and on press.
   *
   * #838: on all three house themes it did neither. The resting rule carries a
   * five-`:not()` chain (added by #379 so this block would stop beating the
   * `sh-*` utilities), and `:not()` contributes its argument's specificity — so
   * resting scored (0,7,0) against hover's (0,3,0) and active's (0,6,0). Both
   * state rules lost to their own neighbour and had never applied.
   *
   * Nothing could see it. No screenshot shows a state that never renders, and
   * every other test in this file reads RESTING only — which is also how a
   * literal `rgb(0 0 0 / 0.3)` survived the whole #376/#426 epic inside the
   * hover rule.
   *
   * The assertion is DIFFERENCE, not specific values. Pinning the exact shadow
   * would break on every legitimate design tweak while still not proving the
   * rule applies; "the three states are three different things" is the property
   * that actually failed, and it fails again the moment the ladder is disturbed.
   *
   * MUTATION CHECK: drop one `:not()` from the hover or active selector in
   * globals.css so it sinks back below resting — that state collapses onto the
   * resting value and this fails.
   */
  test('buttons lift on hover and press on active, on every house theme', async ({
    page,
  }) => {
    const HOUSE = THEMES.filter((t) => t.startsWith('scripthammer-'));
    // Non-vacuity: if the house themes are ever renamed this must fail loudly
    // rather than pass having looped over nothing.
    expect(
      HOUSE.length,
      'no scripthammer-* themes found'
    ).toBeGreaterThanOrEqual(3);

    for (const theme of HOUSE) {
      await page.goto('/');
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);

      // A real, plain `.btn` — not `.btn-ghost`/`.btn-link`, which are flat by
      // design and excluded by the resting rule on purpose.
      await page.evaluate(() => {
        document.querySelector('#sh-838-probe')?.remove();
        const b = document.createElement('button');
        b.id = 'sh-838-probe';
        b.className = 'btn';
        b.textContent = 'probe';
        b.style.position = 'fixed';
        b.style.top = '50%';
        b.style.left = '50%';
        b.style.zIndex = '99999';
        document.body.appendChild(b);
      });

      const probe = page.locator('#sh-838-probe');
      const shadowOf = () =>
        probe.evaluate((el) => window.getComputedStyle(el).boxShadow);

      // Park the pointer away first, or "resting" is whatever the previous
      // iteration left hovered.
      await page.mouse.move(0, 0);
      const resting = await shadowOf();

      await probe.hover();
      // Confirm the state before reading it. The bug being pinned here is precisely a
      // rule that does not apply, and reading a computed value without checking the
      // element is actually in that state is how the original investigation produced
      // three different answers for one source.
      expect(
        await probe.evaluate((el) => el.matches(':hover')),
        `${theme}: probe is not :hover`
      ).toBe(true);

      // POLLED, not read once. DaisyUI transitions box-shadow, so a single read taken
      // straight after .hover() catches the animation MID-FLIGHT — measured
      // `7.05px 14.11px -5.26px`, partway between --sh-plate (6/12/-5) and
      // --sh-plate-lift (10/20/-6). A one-shot read is therefore timing-dependent: it
      // can land on a value equal to resting and fail for no reason. Polling waits for
      // the state to settle and asserts the property instead of a moment.
      await expect.poll(shadowOf, { timeout: 5000 }).not.toBe(resting);
      const hover = await shadowOf();

      await page.mouse.down();
      expect(
        await probe.evaluate((el) => el.matches(':active')),
        `${theme}: probe is not :active`
      ).toBe(true);
      await expect.poll(shadowOf, { timeout: 5000 }).not.toBe(hover);
      const active = await shadowOf();
      await page.mouse.up();

      expect(active, `${theme}: active must differ from resting`).not.toBe(
        resting
      );

      // The depth system exists to replace literal black: it is invisible on a
      // dark surface and grey sludge on a saturated one. This is what went
      // unnoticed for nine tickets inside a rule that never rendered.
      for (const [name, value] of [
        ['resting', resting],
        ['hover', hover],
        ['active', active],
      ] as const) {
        expect(
          value,
          `${theme}: ${name} uses literal black instead of --sh-ink-*`
        ).not.toMatch(/rgba?\(\s*0[,\s]+0[,\s]+0\b/);
      }
    }
  });
});
