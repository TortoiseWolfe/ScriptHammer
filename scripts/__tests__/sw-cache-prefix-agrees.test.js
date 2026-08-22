/**
 * What the build STAMPS into the service worker and what the worker PURGES must be
 * the same prefix (#939).
 *
 * ## The bug this exists to prevent
 *
 * `public/sw.js` names its caches `<brand>-v<semver>…` and its `activate` handler
 * deletes old ones by matching that brand prefix. `scripts/stamp-sw-version.mjs`
 * rewrites the version at build time. For a while the prefix was written down in
 * BOTH files, and they diverged: `rebrand.sh` sweeps `.js` but not `.mjs`, so a fork
 * rebranded the worker to its own name and left the stamp script writing the
 * template's. The build then produced a worker that created caches under one brand
 * and purged another. Nothing ever matched, so every deploy added caches
 * that could never be collected — unbounded storage growth in visitors' browsers.
 *
 * It shipped to production and no test noticed, because the guard in the stamp script
 * compared the version it had just built against the very constant it built it from.
 * A tautology cannot fail.
 *
 * ## Why these assertions and not a simpler one
 *
 * Asserting "both files contain the string the fork's brand" would re-create the original
 * defect in test form: two copies that agree today and can drift tomorrow, and which
 * a rebrand would rewrite in one place only. So instead:
 *
 *   1. the worker must not hard-code a brand in its purge — it must derive it
 *   2. the stamp script must not hard-code one either — it must read the worker
 *   3. and, behaviourally, stamping a worker with an ARBITRARY brand must produce a
 *      version carrying that same brand. (3) is the one that would have caught the
 *      original bug, because it does not care what the brand is.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const SW = path.join(ROOT, 'public', 'sw.js');
const STAMP = path.join(ROOT, 'scripts', 'stamp-sw-version.mjs');

const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

test('the worker derives its purge prefix instead of hard-coding one', () => {
  const code = stripComments(fs.readFileSync(SW, 'utf8'));

  // Comments are stripped first: a guard that matches its own explanation passes
  // with the code deleted, which this repo has paid for repeatedly.
  const hardCoded = [...code.matchAll(/startsWith\((['"])([^'"]+)\1\)/g)].map(
    (m) => m[2]
  );
  assert.deepStrictEqual(
    hardCoded.filter((p) => p.includes('-')),
    [],
    'sw.js purges by a literal prefix. It must use the CACHE_PREFIX derived from ' +
      'CACHE_VERSION, or the stamp script and the purge can disagree — see #939.'
  );

  assert.ok(
    /const CACHE_PREFIX = CACHE_VERSION\.replace\(/.test(code),
    'sw.js must derive CACHE_PREFIX from CACHE_VERSION'
  );
});

test('the stamp script reads the prefix rather than declaring one', () => {
  const code = stripComments(fs.readFileSync(STAMP, 'utf8'));
  const literals = [...code.matchAll(/=\s*(['"])([a-z0-9]+-)\1\s*;/gi)].map(
    (m) => m[2]
  );
  assert.deepStrictEqual(
    literals,
    [],
    'stamp-sw-version.mjs declares a cache prefix. It must parse it out of the ' +
      "worker's authored CACHE_VERSION so the two cannot drift — see #939."
  );
});

test('stamping a worker with ANY brand produces a version carrying that brand', () => {
  // The behavioural check, and the only one that would have caught the shipped bug:
  // it never mentions a brand, so it holds for the template and every fork alike.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-prefix-'));
  const out = path.join(dir, 'out');
  fs.mkdirSync(out);

  const brand = 'zzarbitrarybrand';
  fs.writeFileSync(
    path.join(out, 'sw.js'),
    fs
      .readFileSync(SW, 'utf8')
      .replace(
        /const CACHE_VERSION = '[^']*';/,
        `const CACHE_VERSION = '${brand}-v1.0.0';`
      )
  );
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '9.9.9' })
  );

  execFileSync('node', [STAMP], {
    cwd: dir,
    env: { ...process.env, NEXT_DIST_DIR: 'out' },
    stdio: 'pipe',
  });

  const stamped = /const CACHE_VERSION = '([^']*)';/.exec(
    fs.readFileSync(path.join(out, 'sw.js'), 'utf8')
  )[1];

  assert.ok(
    stamped.startsWith(`${brand}-`),
    `stamped "${stamped}" but the worker purges by "${brand}-" — these must agree, ` +
      'or the worker creates caches it can never collect (#939)'
  );
  assert.ok(
    stamped.includes('9.9.9'),
    `stamped version lost the app version: ${stamped}`
  );

  fs.rmSync(dir, { recursive: true, force: true });
});
