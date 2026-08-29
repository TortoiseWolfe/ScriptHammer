/**
 * The fork checklist must describe every value the deploy actually reads.
 *
 * WHY. `deploy.yml` reads 38 distinct `NEXT_PUBLIC_*` values. The fork docs described
 * 18 at best, and not one of them said which of the two GitHub tabs a value belongs
 * in — while `deploy.yml` reads Supabase from `vars.*`, so putting it in Secrets ships
 * a green deploy with no backend.
 *
 * A hand-typed table is stale the day someone adds a variable, which is how the docs
 * got to 18. So names and tab are DERIVED from the workflow and only the consequence
 * is written by hand, and this fails when the two disagree in either direction.
 *
 * Same job as fork-numbers-agree.test.js, which exists because a re-measured number
 * was updated in one source and not the other four.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..', '..');
const MOD = new URL('../ci/env-inventory.mjs', `file://${__filename}`).href;
const CHECKLIST = join(ROOT, 'docs/FORK-CHECKLIST.md');

describe('fork environment inventory', () => {
  test('every value deploy.yml reads has a consequence recorded', async () => {
    const { reconcile } = await import(MOD);
    const r = reconcile();
    assert.deepStrictEqual(
      r.undocumented,
      [],
      'these are read by deploy.yml but described nowhere — a forker cannot know they exist'
    );
  });

  test('nothing is documented that the deploy no longer reads', async () => {
    const { reconcile } = await import(MOD);
    assert.deepStrictEqual(
      reconcile().stale,
      [],
      'these are described but not read — the doc is promising something that does nothing'
    );
  });

  test('no value is listed twice under different consequences', async () => {
    const { reconcile } = await import(MOD);
    assert.deepStrictEqual(reconcile().duplicated, []);
  });

  test('the committed table lists every value, with the right tab', async () => {
    // Parsed, not compared byte-for-byte: prettier re-pads Markdown table columns, so
    // exact-text equality would fail on formatting alone and teach everyone to
    // regenerate blindly. What matters is that every key is present and filed under
    // the tab deploy.yml actually reads it from.
    const { readWorkflow, tabOf, START, END } = await import(MOD);
    const md = readFileSync(CHECKLIST, 'utf8');
    const between = md.slice(md.indexOf(START) + START.length, md.indexOf(END));

    const listed = new Map();
    for (const m of between.matchAll(
      /\|\s*`(NEXT_PUBLIC_[A-Z0-9_]+)`\s*\|\s*(Secret|Variable)\s*\|/g
    ))
      listed.set(m[1], m[2]);

    const wf = readWorkflow();
    const all = [...wf.secrets, ...wf.vars].sort();

    assert.deepStrictEqual(
      all.filter((k) => !listed.has(k)),
      [],
      'missing from docs/FORK-CHECKLIST.md — run `node scripts/ci/env-inventory.mjs --write`'
    );

    const wrongTab = all.filter((k) => listed.get(k) !== tabOf(wf, k));
    assert.deepStrictEqual(
      wrongTab,
      [],
      'filed under the wrong tab — a Variable listed as a Secret arrives empty at deploy time'
    );
  });

  test('the checklist states which tab, because that is the trap', async () => {
    const md = readFileSync(CHECKLIST, 'utf8');
    // Getting this wrong yields a green deploy and a site with no backend, which is
    // the failure mode CLAUDE.md documents and nothing else warns about.
    assert.match(md, /two tabs/i);
    assert.match(md, /Secrets and variables/);
    assert.match(md, /`NEXT_PUBLIC_SUPABASE_URL`\s*\|\s*Variable/);
  });

  test('the talk deck lists every value too', async () => {
    // The deck's table is generated from the same source, but it is COMMITTED HTML —
    // so a variable added to deploy.yml would leave the slide quietly incomplete, and
    // the slide is the thing an audience photographs.
    const { readWorkflow } = await import(MOD);
    const deck = readFileSync(
      join(ROOT, 'docs/talks/why-build-one-app.html'),
      'utf8'
    );
    const wf = readWorkflow();
    const missing = [...wf.secrets, ...wf.vars].filter(
      (k) => !deck.includes(k)
    );
    assert.deepStrictEqual(
      missing,
      [],
      'the slide is out of date — regenerate its rows from scripts/ci/env-inventory.mjs'
    );
  });

  test('the deck states the two-tab trap, not just the list', async () => {
    const deck = readFileSync(
      join(ROOT, 'docs/talks/why-build-one-app.html'),
      'utf8'
    );
    // 38 names without this is a wall of text; the trap is the content.
    assert.match(deck, /two tabs/i);
    assert.match(deck, /no backend/i);
  });

  test('the counts are not vacuous', async () => {
    const { reconcile } = await import(MOD);
    const { counts } = reconcile();
    // A regex that stopped matching would report zero of everything and pass every
    // assertion above.
    assert.ok(
      counts.secrets > 0,
      'no secrets found — the extractor is not reading the workflow'
    );
    assert.ok(counts.vars > 10, `only ${counts.vars} variables found`);
  });
});
