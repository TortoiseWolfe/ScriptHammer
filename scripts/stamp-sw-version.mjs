#!/usr/bin/env node
/**
 * Stamp a real cache version into the exported service worker (#317).
 *
 * ## Why
 * `public/sw.js` hard-coded `scripthammer-v1.0.0` behind a comment claiming
 * `scripts/rebrand.sh` updated it. It did not — rebrand.sh never mentions
 * sw.js — so the value never changed in the project's life. Every returning
 * visitor kept the precache built on their first visit, forever.
 *
 * That is what promoted a cache-key bug into a permanent condition: a stale
 * precache holding `/blog/` while the user navigates to `/blog` misses on
 * every visit, not just the one after a deploy.
 *
 * ## Why post-build, and not the tracked source
 * Rewriting `public/sw.js` during a build would dirty the working tree on every
 * run and show up as a spurious diff. The static export copies `public/` into
 * `out/`, so the exported copy is rewritten instead — the same approach
 * `scripts/strip-css-script-tags.mjs` already takes for its post-build fixup.
 *
 * ## The prefix is load-bearing, and is READ rather than declared (#939)
 * The worker's `activate` handler purges old caches by matching a prefix it derives
 * from its own CACHE_VERSION. A version stamped with a different prefix would never
 * be cleaned up, trading a stale-cache bug for a storage leak.
 *
 * This file used to declare that prefix itself, which made it a second copy of a
 * string that must agree with the worker — and in a fork the two DID diverge and
 * ship. The check meant to catch it compared the stamped version against the very
 * constant it was built from, so it could not fail.
 *
 * The prefix is now parsed out of the worker's authored CACHE_VERSION, so there is
 * exactly one place the brand appears. Verified below by refusing to stamp when it
 * cannot be parsed — a condition that, unlike its predecessor, can occur.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// execFileSync, not execSync: no shell is spawned, so nothing can be
// interpreted as a shell metacharacter even if this grows arguments later.
import { execFileSync } from 'node:child_process';

// Where the static export actually landed. `next.config.ts` sets
// `distDir: process.env.NEXT_DIST_DIR || '.next'`, and under `output: 'export'`
// a CUSTOM distDir receives the export directly — there is no `out/`. The
// basePath build (scripts/serve-basepath.sh) uses NEXT_DIST_DIR=out-basepath,
// so hard-coding 'out' fails that build outright, which is what it did on
// first contact with the basePath job.
const EXPORT_DIR = join(process.cwd(), process.env.NEXT_DIST_DIR || 'out');
const SW = join(EXPORT_DIR, 'sw.js');

if (!existsSync(SW)) {
  // Non-fatal, but LOUD. A build with no worker to stamp must not fail the
  // build; saying exactly what was skipped is what stops it reading as success
  // — the trap that let the #348 fix silently miss basePath exports.
  console.error(
    `stamp-sw-version: no sw.js at ${SW} — skipping, so CACHE_VERSION was NOT ` +
      `stamped. If this was an export build, NEXT_DIST_DIR is wrong.`
  );
  process.exit(0);
}

/** Short commit SHA, or a timestamp when git is unavailable (e.g. a slim image). */
function buildId() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    // Not a failure: a deploy without git still needs a changing version, and a
    // timestamp changes per build, which is the property that matters.
    return `t${Date.now().toString(36)}`;
  }
}

const { version } = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
);

const source = readFileSync(SW, 'utf-8');
const CACHE_VERSION_LINE = /const CACHE_VERSION = '([^']*)';/;

// THE PREFIX IS READ FROM THE WORKER, NEVER SPELLED OUT HERE (#939).
//
// This file used to hold its own copy of the brand prefix, and the check that
// followed was `cacheVersion.startsWith(<that constant>)` — a tautology, because
// cacheVersion was BUILT from it. It could not fail, which is why the divergence
// it was meant to prevent shipped with the check sitting right next to it.
//
// That divergence was real: `rebrand.sh` could not reach `.mjs`, so a fork
// rebranded public/sw.js and left this script stamping the template's brand. The
// worker then created caches under one name and purged another, and every deploy
// leaked. #922 closed that path by discovering files with `git ls-files`, but two
// strings agreeing because both get swept is incidental — deriving one from the
// other makes it structural.
const authored = source.match(CACHE_VERSION_LINE);

if (!authored) {
  // Fail loudly rather than produce an unversioned worker: a silent no-op here
  // reinstates exactly the bug this script exists to prevent.
  console.error(
    'stamp-sw-version: no `const CACHE_VERSION = "…";` found in out/sw.js. ' +
      'The declaration changed shape — update this pattern.'
  );
  process.exit(1);
}

// e.g. `scripthammer-v1.0.0` -> `scripthammer-`. The same expression the worker
// uses to derive CACHE_PREFIX, so the two agree by construction, not by discipline.
const prefix = authored[1].replace(/-v[\d.].*$/, '') + '-';

if (prefix === '-' || !authored[1].includes('-v')) {
  // A prefix we cannot parse means the worker would purge by something other than
  // what we are about to write. Refuse rather than guess: that mismatch is the
  // storage leak this script exists to prevent, and it is invisible at runtime.
  // Unlike the check this replaced, this condition can actually occur.
  console.error(
    `stamp-sw-version: cannot derive a cache prefix from "${authored[1]}". ` +
      'Expected `<brand>-v<semver>`; the worker purges by the segment before `-v`.'
  );
  process.exit(1);
}

const cacheVersion = `${prefix}v${version}-${buildId()}`;

writeFileSync(
  SW,
  source.replace(
    CACHE_VERSION_LINE,
    `const CACHE_VERSION = '${cacheVersion}';`
  ),
  'utf-8'
);

// Print the REAL path, not a hard-coded 'out/sw.js'. The basePath build writes
// out-basepath/sw.js, and a log naming the wrong file is worse than none.
console.log(`✅ stamp-sw-version: ${SW} CACHE_VERSION = ${cacheVersion}`);
