/**
 * Tests for the canonical gate (#964).
 *
 * THERE WERE NONE, and the gate was unfalsifiable in the one configuration that
 * matters. `routeOf()` builds a path relative to out/, which never carries a
 * prefix; `declared` is a URL pathname, which on a GitHub Pages project site
 * always does. They can only be equal when the prefix is empty. This repository
 * deploys to a custom domain, so its prefix IS empty and the gate is green —
 * while every fork at <owner>.github.io/<repo>/ fails EVERY route. Measured on a
 * real fork: three deploys rejected with 85, then 102 cross-canonicals, before
 * the gate was taught to subtract the prefix.
 *
 * THE PREFIX IS NOT THE basePath, and that distinction is the whole fix. The
 * canonical carries `new URL(projectConfig.deployUrl).pathname`. In THIS repo
 * basePath is "/ScriptHammer" while canonicals read "https://scripthammer.com/"
 * — non-empty basePath, zero prefix. Subtracting basePath unconditionally would
 * break the repo the gate protects. Hence: derive the prefix from the export's
 * own root canonical, and subtract it only where it actually leads.
 *
 * The pairs that matter are 1-vs-2 and 3-vs-4: a fork's self-canonicals must
 * PASS while a genuine cross-canonical in the same fork must still FAIL. Neither
 * could be expressed against the old implementation.
 */
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const SCRIPT = join(__dirname, '..', 'ci', 'check-canonicals.mjs');

/** The gate exits 1 below 20 files (#396 floor), so every fixture must clear it. */
const FILLER = 24;

/**
 * Build a throwaway export and run the real gate against it.
 *
 * `origin` + `prefix` model the deployment: a fork is
 * ('https://owner.github.io', '/widget'); this repo is ('https://scripthammer.com', '').
 * `routes` maps a route to the path its canonical CLAIMS — omit a route's entry
 * and it self-canonicals, which is the common case.
 */
function run({ origin, prefix = '', claims = {}, noCanonical = [] }) {
  const root = mkdtempSync(join(tmpdir(), 'canon-'));
  const out = join(root, 'out');
  mkdirSync(out, { recursive: true });
  try {
    const routes = ['/'];
    for (let i = 0; i < FILLER; i++) routes.push(`/p${i}/`);
    for (const r of Object.keys(claims))
      if (!routes.includes(r)) routes.push(r);
    for (const r of noCanonical) if (!routes.includes(r)) routes.push(r);

    for (const route of routes) {
      const dir = join(out, ...route.split('/').filter(Boolean));
      mkdirSync(dir, { recursive: true });
      const claimed = claims[route] ?? route;
      const link = noCanonical.includes(route)
        ? ''
        : `<link rel="canonical" href="${origin}${prefix}${claimed}"/>`;
      writeFileSync(
        join(dir, 'index.html'),
        `<html><head>${link}</head></html>`
      );
    }

    try {
      const stdout = execFileSync('node', [SCRIPT, out], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out: stdout };
    } catch (err) {
      return {
        code: err.status ?? 1,
        out: `${err.stdout ?? ''}${err.stderr ?? ''}`,
      };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const FORK = { origin: 'https://tortoisewolfe.github.io', prefix: '/widget' };
const DOMAIN = { origin: 'https://scripthammer.com', prefix: '' };

test('PASSES for a fork served under /<repo>/ where every route claims itself', () => {
  const r = run(FORK);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /every route claims itself/);
});

test('STILL FAILS on a genuine cross-canonical inside that same fork', () => {
  // /p3/ claims the fork's homepage. Subtracting the prefix must not blunt this.
  const r = run({ ...FORK, claims: { '/p3/': '/' } });
  assert.strictEqual(r.code, 1, r.out);
  assert.match(r.out, /declare a canonical pointing at a different/);
  assert.match(r.out, /\/p3\//);
});

test('PASSES unchanged for a custom-domain deploy with no prefix', () => {
  const r = run(DOMAIN);
  assert.strictEqual(r.code, 0, r.out);
});

test('STILL FAILS on a cross-canonical with no prefix in play', () => {
  const r = run({ ...DOMAIN, claims: { '/p7/': '/p2/' } });
  assert.strictEqual(r.code, 1, r.out);
  assert.match(r.out, /\/p7\//);
});

test('the prefix is subtracted only where it actually leads', () => {
  // An off-site or off-prefix canonical shares no prefix with the route, so
  // nothing is stripped and it still fails. This is what stops the fix from
  // degenerating into "subtract something, call it equal".
  const r = run({ ...FORK, claims: { '/p5/': '/elsewhere/' } });
  assert.strictEqual(r.code, 1, r.out);
  assert.match(r.out, /\/p5\//);
});

test('routes with no canonical are fine — absence is self-canonical', () => {
  const r = run({ ...FORK, noCanonical: ['/p1/', '/p2/'] });
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /no canonical\s+2/);
});

test('the #396 non-vacuity floor still fires on a nearly-empty export', () => {
  const root = mkdtempSync(join(tmpdir(), 'canon-empty-'));
  const out = join(root, 'out');
  mkdirSync(out, { recursive: true });
  try {
    writeFileSync(join(out, 'index.html'), '<html><head></head></html>');
    let res;
    try {
      execFileSync('node', [SCRIPT, out], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      res = { code: 0 };
    } catch (err) {
      res = {
        code: err.status ?? 1,
        out: `${err.stdout ?? ''}${err.stderr ?? ''}`,
      };
    }
    assert.strictEqual(res.code, 1);
    assert.match(res.out, /not looking at the site/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
