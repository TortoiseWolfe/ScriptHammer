/**
 * Every source that describes a maintenance plan must describe the SAME plan (#1158).
 *
 * WHAT WENT WRONG. Three files answered "what happens to my site if I cancel?" differently:
 *
 *   features/…/spec.md   "Cancelling a maintenance plan stops maintenance. The deployed
 *                         site stays up."
 *   the catalog seed      sold "Hosting, SSL, daily backups" as a thing the plan provides
 *   src/app/terms         "we do not take anything down … we cannot promise the site stays
 *                         reachable"
 *
 * Read together they cannot all be true: a plan that PROVIDES hosting takes the site down
 * when it ends, which is the opposite of what both the spec and the terms promise. The
 * owner's actual position (2026-09-10) is the third one — nothing is torn down, and staying
 * reachable depends on the domain, the account and the buyer's own copy, none of which the
 * seller controls.
 *
 * WHY A GUARD AND NOT JUST A FIX. The feature text lives in FOUR places — the migration seed,
 * the hard-coded list on `/pricing`, a PRD table and a test fixture — and `/pricing`
 * advertises the plan today even though it cannot be bought (`active = false`, no provider
 * plan id). So a visitor reads this copy now, and the next person to edit one of the four has
 * nothing telling them about the other three. That is the drift shape this repo keeps filing.
 *
 * WHAT IT DOES NOT CATCH, said plainly: whether the promise is KEPT. It checks that the
 * sources agree and that none of them has drifted back to the retracted claim.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const MIGRATION = 'supabase/migrations/20251006_complete_monolithic_setup.sql';
const PRICING = 'src/app/pricing/page.tsx';
const TERMS = 'src/app/terms/page.tsx';
const SPEC = 'features/payments/050-commerce-catalog/spec.md';

/** Collapse JSX/markdown line wrapping so a sentence can be matched as a sentence. */
const flat = (s) => s.replace(/\s+/g, ' ');

/**
 * The Care Plan's hosting bullet, as each source states it.
 *
 * Both are matched loosely enough to survive punctuation edits and tightly enough that
 * dropping the qualifier — which is the whole point — fails.
 */
const HOSTING_BULLET =
  /Hosting, SSL and daily backups, on accounts in your name/;

describe('every source describes the same maintenance plan (#1158)', () => {
  it('states the hosting bullet identically in the catalog and on the page', () => {
    // Two sources of truth over one sentence is what produced this issue. They are allowed
    // to exist — the seed is what ships to the database, the page is what a visitor reads
    // while the SKU is inactive — but they are not allowed to disagree.
    assert.match(
      flat(read(MIGRATION)),
      HOSTING_BULLET,
      `${MIGRATION} no longer states the Care Plan hosting bullet as agreed in #1158`
    );
    assert.match(
      flat(read(PRICING)),
      HOSTING_BULLET,
      `${PRICING} no longer states the Care Plan hosting bullet as agreed in #1158`
    );
  });

  it('keeps the qualifier that makes the terms true', () => {
    // "on accounts in your name" is the load-bearing half. Without it the bullet reads as a
    // service that ends with the subscription, and `/terms`' promise that we take nothing
    // down becomes a thing we cannot actually honour.
    for (const file of [MIGRATION, PRICING]) {
      assert.ok(
        /on accounts in your name/.test(flat(read(file))),
        `${file} dropped "on accounts in your name" — that phrase is what makes ` +
          '"cancelling takes nothing down" true rather than a hope.'
      );
    }
  });

  it('still carries the cancellation clause in the terms', () => {
    const terms = flat(read(TERMS));
    assert.ok(
      /Cancelling stops the work, not your site/.test(terms),
      'src/app/terms lost the cancellation clause agreed with the owner on 2026-09-10.'
    );
    assert.ok(
      /cannot promise/.test(terms) && /reachable/.test(terms),
      'the terms promise the site stays reachable, which the seller cannot control. ' +
        'The honest form names the domain, the hosting account and the buyer’s own copy.'
    );
  });

  it('nowhere claims the site simply "stays up"', () => {
    // The retracted claim, in the two places it lived. It is retracted because the catalog
    // contradicted it: a plan that PROVIDES hosting ends the hosting when it ends.
    const offenders = [SPEC, PRICING, MIGRATION, TERMS].filter((f) =>
      /(deployed )?site stays up/i.test(flat(read(f)))
    );
    assert.deepStrictEqual(
      offenders,
      [],
      'A source has gone back to promising the site "stays up" after cancellation. ' +
        'It is not the seller’s to promise: it depends on the domain staying registered, ' +
        'the account it is hosted under, and the buyer holding their own copy (#1158).\n\n' +
        `Offenders:\n  ${offenders.join('\n  ')}`
    );
  });

  it('reads real files, so the sweep is not vacuous', () => {
    // ANTI-VACUITY. A wrong path would make every assertion above pass by inspecting an
    // empty string — the same silent green the contradiction itself enjoyed for months.
    for (const f of [MIGRATION, PRICING, TERMS, SPEC]) {
      assert.ok(
        read(f).length > 500,
        `${f} read as ${read(f).length} bytes — the path is wrong, not the content`
      );
    }
  });

  it('the "stays up" matcher can actually fire', () => {
    // Counterweight: proves the rule above can fail, so it cannot later be defanged by
    // loosening the pattern until the retracted claim slips back through.
    const re = /(deployed )?site stays up/i;
    assert.ok(
      re.test('Cancelling stops maintenance. The deployed site stays up.')
    );
    assert.ok(!re.test('Cancelling stops the work, not your site.'));
  });
});
