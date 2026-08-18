/**
 * The committed per-theme verdicts must still match the themes (#422).
 *
 * `src/config/theme-contrast.ts` is tracked on purpose — `/themes` imports it to render
 * a badge per theme, and CLAUDE.md forbids importing a build product ("generated
 * artifacts are OUTPUTS, never inputs"). The same arrangement makes `public/manifest.json`
 * safe to track: a tracked artifact plus a test that regenerates and compares.
 *
 * WITHOUT THIS TEST THE BADGES ROT SILENTLY, which is worse than having no badges. A
 * DaisyUI upgrade, a token edit in `globals.css`, or a newly enabled theme would leave a
 * plate asserting "AAA" from a number nobody recomputed — the #287 failure mode that
 * #422 exists to avoid, reintroduced by the fix for it.
 *
 * WHAT THIS DOES NOT CHECK, stated so a green run is not over-read: that the conversion
 * from `oklch()` to sRGB is itself correct. That is
 * `tests/e2e/oklch-browser-parity.spec.ts`, which compares all 536 theme colours against
 * what Chromium actually paints. This test only proves the committed file agrees with the
 * computation; the parity spec proves the computation agrees with reality.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const COMMITTED = path.join(ROOT, 'src', 'config', 'theme-contrast.json');

/**
 * The committed verdicts.
 *
 * Read as real JSON rather than scraped out of a `.ts` literal. The first version did
 * the latter, and lint-staged's prettier pass unquoted every key on commit, so this
 * guard broke on the repo's own formatting rather than on any real drift. JSON survives
 * prettier unchanged and is the same file the app imports.
 */
function committed() {
  try {
    return JSON.parse(fs.readFileSync(COMMITTED, 'utf8'));
  } catch {
    return null;
  }
}

describe('committed theme contrast verdicts are current (#422)', () => {
  it('the committed file parses and is not empty', async () => {
    // Non-vacuity first: a regex that stopped matching would make every assertion
    // below pass against an empty array — the #396 shape.
    const data = committed();

    assert.ok(data, `could not parse THEME_CONTRAST out of ${COMMITTED}`);
    assert.ok(
      data.length >= 30,
      `only ${data.length} themes committed; the app enables 35`
    );
  });

  it('matches a fresh computation from the themes themselves', async () => {
    const { computeVerdicts } = await import('../theme-contrast/compute.mjs');
    const fresh = computeVerdicts(ROOT);
    const stored = committed();

    // Compared as data, not as text, so formatting churn cannot fail this and a real
    // number change cannot pass it.
    assert.deepEqual(
      stored,
      fresh,
      'src/config/theme-contrast.ts is stale — a theme, a token or the enabled list ' +
        'changed and the badges on /themes would now assert numbers nobody recomputed. ' +
        'Regenerate: docker compose exec scripthammer node scripts/theme-contrast/generate.mjs'
    );
  });

  it('no enabled theme is left without a verdict', async () => {
    // "unknown" must never reach a badge. It appeared for real during development:
    // `scripthammer-forge` is authored in HEX rather than oklch, and an oklch-only
    // parser skipped it silently — a theme a visitor can pick, with no verdict, and
    // nothing saying so.
    const { enabledThemes } = await import('../theme-contrast/compute.mjs');
    const enabled = enabledThemes(ROOT);
    const stored = committed();

    const missing = enabled.filter((t) => !stored.some((v) => v.theme === t));
    const unknown = stored
      .filter((v) => v.level === 'unknown')
      .map((v) => v.theme);

    assert.deepEqual(missing, [], 'enabled themes with no verdict at all');
    assert.deepEqual(
      unknown,
      [],
      'themes whose verdict is "unknown" — usually a token notation the parser does ' +
        'not read yet (oklch and hex are both supported). Fix the parser rather than ' +
        'letting a plate render an unbacked badge.'
    );
  });
});
