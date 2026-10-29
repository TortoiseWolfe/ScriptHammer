/**
 * apply-migration-section must cut exactly one section and refuse everything else.
 *
 * The script runs SQL against the production database from a workflow, so every refusal
 * is driven here, and the real migration is cut too: the band-vote section must hold the
 * table and the function and must not run on into the end-of-file DROP ... CASCADE lines.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MODULE = path.resolve(
  __dirname,
  '..',
  'ci',
  'apply-migration-section.mjs'
);
const MIGRATION = path.resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20251006_complete_monolithic_setup.sql'
);

const RULE = '-- ' + '='.repeat(40);
const banner = (t) => `${RULE}\n-- ${t}\n${RULE}`;

const FILE = [
  banner('FIRST THING (#1)'),
  'CREATE TABLE IF NOT EXISTS a (id INT);',
  '',
  banner('SECOND THING (#2)'),
  'CREATE TABLE IF NOT EXISTS b (id INT);',
  'CREATE TABLE IF NOT EXISTS b2 (id INT);',
  '',
  banner('NOTES ONLY'),
  '-- nothing to run here',
  '',
  banner('SECOND THING AGAIN'),
  'SELECT 1;',
  '',
  banner('HAS ITS OWN COMMIT'),
  'COMMIT;',
  '',
].join('\n');

describe('extractSection', () => {
  it('cuts from its banner to the next banner and no further', async () => {
    const { extractSection } = await import(MODULE);
    const s = extractSection(FILE, 'FIRST THING');
    assert.match(s.sql, /CREATE TABLE IF NOT EXISTS a /);
    assert.doesNotMatch(s.sql, /TABLE IF NOT EXISTS b /);
    assert.doesNotMatch(s.sql, /SECOND THING/);
    assert.ok(s.sql.startsWith(RULE), 'starts at the banner rule line');
  });

  it('matches case-insensitively on the start of the title', async () => {
    const { extractSection } = await import(MODULE);
    const s = extractSection(FILE, 'second thing (#2');
    assert.match(s.sql, /b2/);
    assert.doesNotMatch(s.sql, /SELECT 1/);
  });

  it('refuses a missing banner, and lists the ones that exist', async () => {
    const { extractSection } = await import(MODULE);
    assert.throws(
      () => extractSection(FILE, 'NO SUCH SECTION'),
      /No banner starts with[\s\S]*FIRST THING/
    );
  });

  it('refuses an empty or very short title', async () => {
    const { extractSection } = await import(MODULE);
    assert.throws(() => extractSection(FILE, ''), /banner title/);
    assert.throws(() => extractSection(FILE, '   '), /banner title/);
    assert.throws(() => extractSection(FILE, 'FIRST'), /banner title/);
  });

  it('refuses a title that matches two banners', async () => {
    const { extractSection } = await import(MODULE);
    assert.throws(() => extractSection(FILE, 'SECOND THING'), /matches 2/);
  });

  it('refuses a section with comments only', async () => {
    const { extractSection } = await import(MODULE);
    assert.throws(() => extractSection(FILE, 'NOTES ONLY'), /no SQL/);
  });

  it('refuses a section that carries its own COMMIT', async () => {
    const { extractSection } = await import(MODULE);
    assert.throws(
      () => extractSection(FILE, 'HAS ITS OWN COMMIT'),
      /BEGIN, COMMIT or ROLLBACK/
    );
  });
});

describe('wrapInTransaction', () => {
  it('wraps the section in BEGIN and COMMIT', async () => {
    const { wrapInTransaction } = await import(MODULE);
    const out = wrapInTransaction('SELECT 1;');
    assert.ok(out.startsWith('BEGIN;\n'));
    assert.ok(out.trimEnd().endsWith('COMMIT;'));
  });
});

describe('the real migration', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');

  it('cuts the band vote section: table and function, nothing after it', async () => {
    const { extractSection } = await import(MODULE);
    const s = extractSection(sql, 'BAND PAGE ANONYMOUS SONG VOTES');
    assert.match(s.sql, /CREATE TABLE IF NOT EXISTS band_site_votes/);
    assert.match(s.sql, /CREATE OR REPLACE FUNCTION public\.cast_band_vote/);
    assert.match(s.sql, /GRANT EXECUTE ON FUNCTION public\.cast_band_vote/);
    assert.doesNotMatch(s.sql, /handle_new_user/);
    assert.doesNotMatch(s.sql, /^COMMIT;/m);
  });

  it('every banner title in the file is found, so a title can be named', async () => {
    const { findBanners } = await import(MODULE);
    const titles = findBanners(sql.split('\n')).map((b) => b.title);
    assert.ok(titles.length >= 10, `found ${titles.length} banners`);
    assert.ok(titles.some((t) => t.startsWith('END-OF-FILE CLEANUP')));
  });
});
