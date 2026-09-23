const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

/**
 * Simulated deploys must never hand a later generation an earlier generation's
 * stylesheet name (#1278). The previous transform did, for ~1% of hashes, after two
 * renames — and that turned the required accessibility check red on about one build in
 * twenty.
 */
const load = () => import('../lib/stale-html-rename.mjs');

// The hash that tripped #1277 in CI, and neighbours from the same build.
const HASHES = [
  '65ff33586f803f5f',
  '11f44f88586a4ab5',
  '3e2250ad879c9632',
  'beb446ff02cd9add',
];

// The transform this replaces, kept here only to prove the input is dangerous.
const legacy = (f) =>
  f.replace(/^[a-f0-9]+/, (h) =>
    h
      .split('')
      .reverse()
      .join('')
      .replace(/[a-f]/g, (c) => (c === 'f' ? 'a' : 'f'))
  );

test('CONTROL: the old transform returned 65ff33586f803f5f to itself after two deploys', () => {
  assert.equal(legacy(legacy('65ff33586f803f5f.css')), '65ff33586f803f5f.css');
});

test('no generation reuses an earlier generation’s name, for the hashes that broke CI', async () => {
  const { renameHash } = await load();
  for (const h of HASHES) {
    const a = `${h}.css`;
    const b = renameHash(a, 'build B');
    const c = renameHash(b, 'build C');
    assert.notEqual(b, a, `${h}: B reuses A`);
    assert.notEqual(c, a, `${h}: C reuses A`);
    assert.notEqual(c, b, `${h}: C reuses B`);
  }
});

test('no round-trip across 20,000 random hashes (the old transform: ~1%)', async () => {
  const { renameHash } = await load();
  let oldTrips = 0;
  for (let i = 0; i < 20000; i++) {
    let h = '';
    for (let j = 0; j < 16; j++)
      h += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    const a = `${h}.css`;
    assert.notEqual(
      renameHash(renameHash(a, 'build B'), 'build C'),
      a,
      `${h} round-trips`
    );
    if (legacy(legacy(a)) === a) oldTrips++;
  }
  // The same loop must be able to see the old failure, or the assertion above is vacuous.
  assert.ok(
    oldTrips > 50,
    `expected the old transform to round-trip ~200 of 20k, saw ${oldTrips}`
  );
});

test('deterministic, and keeps the hash shape the harness rewrites references by', async () => {
  const { renameHash } = await load();
  assert.equal(
    renameHash('65ff33586f803f5f.css', 'build B'),
    renameHash('65ff33586f803f5f.css', 'build B')
  );
  assert.match(
    renameHash('65ff33586f803f5f.css', 'build B'),
    /^[0-9a-f]{16}\.css$/
  );
});

test('the harness uses it, and asserts directly that build C holds none of A’s names', () => {
  const src = readFileSync(
    path.join(__dirname, '..', 'check-stale-html.mjs'),
    'utf8'
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.match(src, /renameHash\(f, tag\)/);
  assert.doesNotMatch(src, /\.reverse\(\)/, 'the old transform is back');
  assert.match(src, /build C still carries build A's stylesheet name/);
});
