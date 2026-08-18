/**
 * Every interactive row in the global nav needs an explicit height floor (#378, #502).
 *
 * WHY A STATIC CHECK AND NOT AN E2E. DaisyUI renders `menu li > a` at **26px**, so a nav
 * row without an explicit floor is half the 44px target and looks completely normal in
 * review — the class that is missing is the whole defect, and nothing about the row's
 * appearance says so.
 *
 * `GlobalNav.tsx` had exactly one such row: the signed-in Messages link carried a bare
 * `flex items-center justify-between` while its own twin in the mobile menu carried
 * `${MENU_ITEM} justify-between`. It survived because **no gate could see it**:
 * `mobile-touch-targets.spec.ts` measures `.dropdown-content a` with the menu open, but
 * it runs signed OUT, and that row only renders signed in.
 *
 * Extending the E2E to authenticate would be the thorough answer and is much larger than
 * the defect. This asserts the property where it is decidable — in the source — and it
 * catches the exact shape that occurred: a row that forgot what all its siblings have.
 *
 * WHAT THIS CANNOT CHECK, stated so a green run is not over-read: it proves a floor CLASS
 * is present, not that the rendered box is 44px. The E2E owns that for signed-out rows,
 * and nothing owns it for signed-in ones — which is recorded in #502 rather than implied
 * to be covered here.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const NAV = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'components',
  'GlobalNav.tsx'
);

/**
 * Tokens that establish a height floor.
 *
 * `MENU_ITEM` is the shared constant (`min-h-11 flex items-center`). `btn` carries
 * DaisyUI's own height. `leading-11` is the footer-style floor used where a box would
 * break inline prose. A `cls`/`base` variable is accepted because the string is built
 * elsewhere in the file and is asserted separately by its own definition.
 */
const FLOOR = /MENU_ITEM|min-h-11|leading-11|\bbtn\b|\{cls\}|\{base\}/;

/** Rows that are not interactive and therefore carry no touch target. */
const NOT_A_ROW = /menu-title|divider/;

/**
 * Each `<li>` in the file, paired with the first `className` beneath it.
 *
 * Deliberately crude: a JSX parser would be more precise, but the property being
 * asserted is "somebody forgot a class on a row", which is visible in the raw text. The
 * count assertion below is what stops the crudeness from silently measuring nothing.
 */
function navRows() {
  const lines = fs.readFileSync(NAV, 'utf8').split('\n');
  const rows = [];
  lines.forEach((line, i) => {
    if (!/^\s*<li[\s>]/.test(line)) return;
    if (NOT_A_ROW.test(line)) return;

    // Look ahead for the first className within the row's opening element.
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      if (/^\s*<\/li>/.test(lines[j])) break;
      if (/^\s*<li[\s>]/.test(lines[j])) break;
      const m = lines[j].match(/className=(\{`[^`]*`\}|"[^"]*"|\{[^}]*\})/);
      if (m) {
        rows.push({ line: j + 1, className: m[1] });
        break;
      }
    }
  });
  return rows;
}

describe('every global-nav row has an explicit height floor (#378, #502)', () => {
  it('finds a meaningful number of nav rows', () => {
    // Without this the assertion below passes vacuously the moment the markup is
    // restructured — the #396 shape, and the reason this file has a floor at all.
    const rows = navRows();

    assert.ok(
      rows.length >= 10,
      `expected to find the nav's rows in GlobalNav.tsx, found ${rows.length}. ` +
        `If the markup moved, point this guard at it rather than deleting it.`
    );
  });

  it('has no row missing its height floor', () => {
    const missing = navRows()
      .filter((r) => !FLOOR.test(r.className))
      .map((r) => `GlobalNav.tsx:${r.line} — ${r.className}`);

    assert.deepEqual(
      missing,
      [],
      'a nav row with no height floor. DaisyUI renders `menu li > a` at 26px, so ' +
        'this ships a 26px touch target against a 44px standard and looks normal in ' +
        'review (#378). Use the shared `MENU_ITEM` constant. Note the signed-in rows ' +
        'are measured by NO e2e gate — the touch-target sweep runs signed out (#502).'
    );
  });

  it('the detector can actually fail', () => {
    // The control. A regex matching everything would report the file as clean.
    assert.equal(FLOOR.test('"flex items-center justify-between"'), false);
    assert.equal(FLOOR.test('{`${MENU_ITEM} justify-between`}'), true);
    assert.equal(FLOOR.test('"min-h-11 flex items-center"'), true);
    assert.equal(FLOOR.test('"btn btn-ghost btn-circle"'), true);
    assert.equal(NOT_A_ROW.test('<li className="menu-title">'), true);
  });
});
