/**
 * No test may restate the theme list; it must derive it (#915).
 *
 * WHAT HAPPENED. `src/config/themes.ts` is the canonical list — 35 themes, 3 of them ours.
 * Six test files each typed a subset by hand, and every one of them missed
 * `scripthammer-forge`, which shipped after they were written:
 *
 *   color-contrast.spec.ts          2 house themes, under a comment saying "Both"
 *   cod-skeleton-hud-contrast.spec  2 house themes
 *   embed-theme-contrast.spec.ts    34 of 35
 *   depth-tokens.spec.ts            2 house themes — while line ~367 of the SAME FILE
 *                                   derived all three correctly
 *   theme-switching.spec.ts         32 of 35, having already imported THEME_COUNT
 *   ThemePage.ts                    31 of 35
 *
 * `color-contrast.spec.ts` is the AAA gate #411 built after a hand-written FOUR-ROUTE list
 * let a 6.44:1 eyebrow reach main behind 17 green checks. It enumerates its routes for that
 * reason and hand-wrote its themes — the same defect, in the same file, on the other axis.
 * The word "Both" was the completeness claim, and it stopped being true silently.
 *
 * This guard is deliberately about the SOURCE, not the outcome. A test asserting "forge is
 * covered" would pass the moment someone typed forge into six lists by hand, and the seventh
 * theme would repeat the whole story.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'src/config/themes.ts');

/** Files that must derive their themes rather than restate them. */
const MUST_DERIVE = [
  'tests/e2e/color-contrast.spec.ts',
  'tests/e2e/cod-skeleton-hud-contrast.spec.ts',
  'tests/e2e/embed-theme-contrast.spec.ts',
  'tests/e2e/tests/depth-tokens.spec.ts',
  'tests/e2e/tests/theme-switching.spec.ts',
];

/** A house theme name appearing as a string literal — the restating signature. */
const LITERAL = /'scripthammer-(dark|light|forge)'/;

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function canonical() {
  const src = fs.readFileSync(CONFIG, 'utf8');
  const block = /export const THEMES = \[([\s\S]*?)\] as const/.exec(src);
  assert.ok(block, 'THEMES not found in src/config/themes.ts');
  return [...block[1].matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
}

describe('theme lists are derived, not restated (#915)', () => {
  it('the canonical list was read and is plausible', () => {
    // Anti-vacuity. If this regex stops matching, every assertion below compares against
    // an empty list and passes — the exact shape #396 catalogues.
    const all = canonical();
    assert.ok(
      all.length >= 30,
      `only ${all.length} themes parsed — the parser is stale`
    );
    const house = all.filter((t) => t.startsWith('scripthammer-'));
    assert.ok(
      house.length >= 3,
      `only ${house.length} house themes parsed; forge is the one that kept getting missed`
    );
  });

  for (const rel of MUST_DERIVE) {
    it(`${path.basename(rel)} imports its themes`, () => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.match(
        src,
        /from '@\/config\/themes'/,
        `${rel} does not import the canonical list, so its themes are typed by hand`
      );
    });

    it(`${path.basename(rel)} contains no hand-typed house theme`, () => {
      // Comments stripped first: several of these files DISCUSS the theme names while
      // explaining why they derive them, and matching that prose would fail a correct file.
      const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      const hits = code.split('\n').filter((l) => LITERAL.test(l));
      assert.deepStrictEqual(
        hits.map((l) => l.trim()),
        [],
        `${rel} names a house theme as a literal. Every list that did this missed ` +
          '`scripthammer-forge`. Import HOUSE_THEMES or THEMES from @/config/themes.'
      );
    });
  }

  it('HOUSE_THEMES is exported and derived from THEMES', () => {
    const code = stripComments(fs.readFileSync(CONFIG, 'utf8'));
    assert.match(
      code,
      /export const HOUSE_THEMES = THEMES\.filter/,
      'HOUSE_THEMES must be derived from THEMES, not typed'
    );
    assert.match(
      code,
      /export const HOUSE_THEME_COUNT = HOUSE_THEMES\.length/,
      'HOUSE_THEME_COUNT must come from HOUSE_THEMES so the two cannot disagree'
    );
  });
});

/**
 * A house theme's DARKNESS must be derived from its own colours, not remembered.
 *
 * `src/utils/theme-utils.ts` DARK_THEMES drives "map tiles, Disqus, Calendly, Cal.com, and
 * Leaflet CSS" by its own docblock. `scripthammer-forge` ships `base-100: #0f0d0b` — near
 * black — and was absent from that list, so on forge every one of those rendered in LIGHT
 * mode over a near-black page. It was the third house theme, and every hand-maintained theme
 * list in the repo missed it.
 *
 * Asserting "forge is in DARK_THEMES" would pass the moment someone typed it in and would say
 * nothing about the fourth house theme. This computes luminance from the theme's own
 * `--color-base-100` and requires the list to agree.
 */
describe('house-theme darkness is derived from its colours (#915)', () => {
  const CSS = path.join(ROOT, 'src/app/globals.css');
  const UTILS = path.join(ROOT, 'src/utils/theme-utils.ts');

  /** sRGB relative luminance from a #rrggbb string. */
  function luminance(hex) {
    const n = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** Each house theme's base-100, as a luminance, for the forms globals.css actually uses. */
  function houseBase100() {
    const css = fs.readFileSync(CSS, 'utf8');
    const out = {};
    for (const theme of canonical().filter((t) =>
      t.startsWith('scripthammer-')
    )) {
      const block =
        new RegExp(`name:\\s*'${theme}';([\\s\\S]*?)\\n\\}`).exec(css) ??
        new RegExp(`\\[data-theme='?${theme}'?\\]\\s*\\{([\\s\\S]*?)\\}`).exec(
          css
        );
      if (!block) continue;
      const v = /--color-base-100:\s*([^;]+);/.exec(block[1]);
      if (!v) continue;
      const raw = v[1].trim();
      if (raw.startsWith('#')) out[theme] = luminance(raw);
      else {
        // oklch(L% ...) — the L component is already perceptual lightness; 0.5 splits
        // light from dark well enough for a binary classification.
        const l = /oklch\(\s*([\d.]+)%/.exec(raw);
        if (l) out[theme] = Number(l[1]) / 100;
      }
    }
    return out;
  }

  it('every house theme base-100 was parsed', () => {
    // Anti-vacuity: an unparsed theme silently drops out of the comparison below.
    const bases = houseBase100();
    const house = canonical().filter((t) => t.startsWith('scripthammer-'));
    assert.deepStrictEqual(
      house.filter((t) => bases[t] === undefined),
      [],
      'a house theme has no readable --color-base-100 in globals.css'
    );
  });

  it('DARK_THEMES agrees with each house theme own luminance', () => {
    const bases = houseBase100();
    const listed = new Set(
      [
        ...stripComments(fs.readFileSync(UTILS, 'utf8')).matchAll(
          /'([\w-]+)'/g
        ),
      ].map((m) => m[1])
    );
    const wrong = Object.entries(bases)
      .filter(([theme, lum]) => lum < 0.5 !== listed.has(theme))
      .map(
        ([theme, lum]) =>
          `${theme} (luminance ${lum.toFixed(3)}, ${lum < 0.5 ? 'DARK' : 'light'}) is ` +
          `${listed.has(theme) ? 'in' : 'NOT in'} DARK_THEMES`
      );
    assert.deepStrictEqual(
      wrong,
      [],
      'DARK_THEMES disagrees with a theme own colours. That list drives map tiles, ' +
        'Disqus, Calendly, Cal.com and Leaflet CSS, so a miss renders them in the wrong ' +
        'mode over the whole page.'
    );
  });
});
