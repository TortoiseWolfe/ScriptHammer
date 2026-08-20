/**
 * `text-base-content` must not be dimmed by opacity at all (#411, #462).
 *
 * WHY A GUARD AND NOT JUST A FIX. #411 measured these failing the 7:1 AAA gate and
 * removed them. They came back — eight live instances in `src/twin/cesium/` and two in
 * a story, found on 2026-08-18 while working #462. Nothing noticed for months, and
 * nothing could have: #459 records that axe-core returns a **pass** with
 * `contrastRatio: null` for these nodes, so `color-contrast.spec.ts` — which asserts on
 * `violations` — has been green on them the whole time. A removal without a guard is a
 * removal that gets undone.
 *
 * THE MEASUREMENT, from #462 (canvas readback, because `getComputedStyle` returns
 * `oklch()` unparsed). Gate is 7:1, `scripthammer-light`:
 *
 *              /100    /85    /80    /70
 *   base-100  12.96   8.30   7.08   5.20   <- /70 fails
 *   base-200  11.73   7.73   6.62   4.98   <- /80 and below fail
 *   base-300  10.10   6.88   6.05   4.57   <- /85 and below fail
 *
 * So `/70` and below fail on EVERY surface in the light theme, with no judgement call
 * about which surface the text landed on. That is what this file pins.
 *
 * `/80` AND `/85` ARE NOW BANNED TOO, and the reason the old note here gave for sparing
 * them turned out to be wrong. It said they were "surface-DEPENDENT" — `/80` passing on
 * `base-100` at 7.08 — but that table measures only `scripthammer-light`. Recomputed
 * across ALL 35 enabled themes (composite in sRGB, then WCAG 2.x luminance, via
 * scripts/theme-contrast/compute.mjs):
 *
 *              cells failing 7:1     worst ratio    a surface safe on every theme?
 *   /85          29 of 105              4.01                    NONE
 *   /80          38 of 105              3.78                    NONE
 *
 * There is no surface on which either is safe, so there was never a per-call-site
 * judgement to make — the worst cases sit at roughly half the gate. The 184-instance
 * sweep the old note deferred is done.
 *
 * This is why the regex now bans every opacity below 100 rather than a hand-picked set:
 * "which opacities are safe" depends on the theme set, and the theme set changes.
 *
 * The instances found in 2026-08 were worse than the table suggests: they sat on
 * `bg-base-100/90` with `backdrop-blur`, floating over the Cesium canvas, at 10-11px.
 * The table assumes OPAQUE surfaces, so a translucent panel over an arbitrary 3D
 * backdrop is unbounded-worse than its worst row — the #715 lesson.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO_ROOT, 'src');

/**
 * ANY opacity below 100 (#462).
 *
 * Not a list of "the bad ones": measured across all 35 themes, none of them is safe on
 * any surface. Size and weight de-emphasise text without costing contrast.
 */
const BANNED = /text-base-content\/(?:[1-9]?[0-9])\b/;

/**
 * Source files only.
 *
 * `src/lib/blog/blog-data.json` is a GENERATED build artifact whose content is prose
 * from blog posts — it contains these class names as text, not as markup this app
 * renders. Scanning it would make this test fail on someone writing about the bug.
 */
const EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css']);

function sourceFiles(dir = SRC, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * DECORATIVE CONTENT IS EXEMPT, and that is WCAG, not a loophole. Contrast minimums
 * apply to text and to meaningful graphics; content hidden from the accessibility tree
 * conveys nothing to a reader, so dimming it costs nothing.
 *
 * The four hits this covers today are a 24x24 illustration in an empty state and three
 * `→` glyphs whose row already carries its own visible label — one of which has a
 * comment saying exactly that (#377). Banning them would push someone to delete the
 * affordance or make it shout, neither of which helps anybody.
 *
 * The window is deliberately small: `aria-hidden` has to be on the same element, not
 * merely somewhere in the file.
 */
function isDecorative(lines, index, window = 6) {
  const from = Math.max(0, index - window);
  const to = Math.min(lines.length - 1, index + window);
  return lines.slice(from, to + 1).some(isDecorativeMarker);
}

/**
 * The two ways this codebase marks something decorative:
 *
 *   aria-hidden="true"    the platform attribute
 *   decorative            `<Icon … decorative />`, which Icon.tsx:61 turns into
 *                         `aria-hidden: true`. The component forces the author to
 *                         choose between a name and `decorative`, so the prop is a
 *                         stronger signal than the raw attribute, not a weaker one.
 *
 * A COMMENT SAYING "Decorative:" DOES NOT COUNT, and that distinction is load-bearing:
 * `src/app/docs/page.tsx` carries exactly such a comment, and the thing that actually
 * hides the glyph is the `decorative` prop six lines below it. Accepting prose would
 * let a stale comment exempt live markup.
 */
function isDecorativeMarker(line) {
  if (/aria-hidden=["']true["']/.test(line)) return true;
  // A bare JSX attribute on its own — not the word appearing in prose.
  return /(^|\s)decorative(\s*=\s*\{true\})?\s*(\/?>)?\s*$/.test(line);
}

/**
 * Non-JSX exemptions, each with its reason. Never add one silently — an exclusion with
 * no stated reason is how a coverage floor drops without anyone deciding to drop it
 * (#396).
 */
const ALLOWED = {
  'src/app/globals.css':
    'code-block line numbers (`.line-number`, `select-none`), dimmed so they recede ' +
    'behind the code and excluded from copy. Arguably informational rather than ' +
    'decorative — recorded in #462 as unresolved rather than settled here.',
};

function offenders() {
  const found = [];
  for (const file of sourceFiles()) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      const m = text.match(/text-base-content\/(\d+)/g);
      if (!m) return;
      const rel = path.relative(REPO_ROOT, file);
      for (const cls of m) {
        // Uses BANNED, the same rule the self-test exercises. This line used to read
        // `if (pct > 70) continue`, a SECOND hardcoded copy of the threshold — so
        // widening BANNED to cover /80 and /85 changed nothing here and the guard went
        // on passing against a reintroduced /80. Caught by mutation, not by review.
        // One rule, one place.
        if (!BANNED.test(cls)) continue;
        if (ALLOWED[rel]) continue;
        if (isDecorative(lines, i)) continue;
        found.push(`${rel}:${i + 1} (${cls})`);
      }
    });
  }
  return found.sort();
}

describe('dimmed body text stays above the AAA floor (#411, #462)', () => {
  it('scans a meaningful number of source files', () => {
    // Without this the assertion below passes vacuously if the walk breaks or `src`
    // moves — the #396 shape, and the reason this file has a control at all.
    const files = sourceFiles();

    assert.ok(
      files.length > 200,
      `expected to scan the whole of src/, walked only ${files.length} files`
    );
  });

  it('has no text-base-content dimmed by opacity at all', () => {
    assert.deepEqual(
      offenders(),
      [],
      'text-base-content at 70% opacity or below fails the 7:1 AAA gate on EVERY ' +
        'surface in the light theme (#462: /70 measures 5.20 on base-100, 4.98 on ' +
        'base-200, 4.57 on base-300). Use solid `text-base-content` and carry the ' +
        'de-emphasis with size or weight, which cost no contrast. axe-core will NOT ' +
        'catch this — it returns a pass with contrastRatio: null (#459).'
    );
  });

  it('the detector can actually fail', () => {
    // The control. A regex that matched nothing would report the repo as clean.
    // Exercises BANNED itself rather than a reimplementation of it. The previous
    // version re-derived the rule inline (`<= 70`), so it agreed with the regex only
    // by coincidence — and it kept passing after BANNED was widened, still claiming
    // /80 was allowed. A control that tests a COPY of the thing is not a control.
    const check = (line) => BANNED.test(line);

    assert.equal(check('<p className="text-base-content/70 text-sm">'), true);
    assert.equal(check('<p className="text-base-content/60 text-sm">'), true);
    assert.equal(check('<p className="text-base-content/50">'), true);
    // Banned as of #462: measured across all 35 themes, neither is safe on ANY
    // surface. This assertion read `false` while that was believed to be a
    // per-surface judgement call.
    assert.equal(check('<p className="text-base-content/80">'), true);
    assert.equal(check('<p className="text-base-content/85">'), true);
    assert.equal(check('<p className="text-base-content/95">'), true);
    // Full opacity is the only acceptable form and must NOT trip the regex.
    assert.equal(check('<p className="text-base-content">'), false);
    assert.equal(check('<p className="text-base-content-foo">'), false);
    assert.ok(BANNED instanceof RegExp);
  });

  it('the decorative exemption is narrow, and can also fail', () => {
    // If `isDecorative` returned true for everything, the whole guard would be
    // decoration itself — which is the failure mode this repo keeps paying for.
    const withAria = [
      '<span',
      '  aria-hidden="true"',
      '  className="text-base-content/30"',
      '>',
    ];
    const withoutAria = ['<span', '  className="text-base-content/30"', '>'];

    assert.equal(isDecorative(withAria, 2), true, 'aria-hidden must exempt');
    assert.equal(
      isDecorative(withoutAria, 1),
      false,
      'text with no aria-hidden must NOT be exempted'
    );

    // And it must not reach across the file to find an unrelated aria-hidden.
    const farAway = ['aria-hidden="true"', ...Array(20).fill('filler'), 'x'];
    assert.equal(
      isDecorative(farAway, farAway.length - 1),
      false,
      'aria-hidden 20 lines away is a different element and must not exempt'
    );

    // The repo's own marker counts...
    assert.equal(
      isDecorativeMarker('            decorative'),
      true,
      '`decorative` as a bare JSX prop must exempt — Icon.tsx:61 makes it aria-hidden'
    );
    // ...but PROSE about being decorative must not. src/app/docs/page.tsx has both,
    // and only the prop is what actually hides the glyph.
    assert.equal(
      isDecorativeMarker(
        "          {/* Decorative: the row's own label is the accessible name,"
      ),
      false,
      'a comment claiming decorativeness must NOT exempt live markup'
    );
    assert.equal(
      isDecorativeMarker('  // this icon is decorative in spirit'),
      false,
      'prose ending in the word must not exempt either'
    );
  });
});
