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
 * ## The prefix is load-bearing
 * The worker's `activate` handler purges old caches by matching names starting
 * with `scripthammer-`. A version without that prefix would never be cleaned
 * up, trading a stale-cache bug for a storage leak. Asserted below.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// execFileSync, not execSync: no shell is spawned, so nothing can be
// interpreted as a shell metacharacter even if this grows arguments later.
import { execFileSync } from 'node:child_process';

const SW = join(process.cwd(), 'out', 'sw.js');
const REQUIRED_PREFIX = 'scripthammer-';

if (!existsSync(SW)) {
  console.error(
    `stamp-sw-version: ${SW} not found. This runs AFTER \`next build\`; ` +
      'if the export moved, update this path rather than skipping silently.'
  );
  process.exit(1);
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
const cacheVersion = `${REQUIRED_PREFIX}v${version}-${buildId()}`;

if (!cacheVersion.startsWith(REQUIRED_PREFIX)) {
  console.error(
    `stamp-sw-version: refusing to write "${cacheVersion}" — the activate ` +
      `handler purges old caches by the "${REQUIRED_PREFIX}" prefix, so this ` +
      'would leak storage instead of cleaning it up.'
  );
  process.exit(1);
}

const source = readFileSync(SW, 'utf-8');
const CACHE_VERSION_LINE = /const CACHE_VERSION = '[^']*';/;

if (!CACHE_VERSION_LINE.test(source)) {
  // Fail loudly rather than produce an unversioned worker: a silent no-op here
  // reinstates exactly the bug this script exists to prevent.
  console.error(
    'stamp-sw-version: no `const CACHE_VERSION = "…";` found in out/sw.js. ' +
      'The declaration changed shape — update this pattern.'
  );
  process.exit(1);
}

writeFileSync(
  SW,
  source.replace(CACHE_VERSION_LINE, `const CACHE_VERSION = '${cacheVersion}';`),
  'utf-8'
);

console.log(`✅ stamp-sw-version: out/sw.js CACHE_VERSION = ${cacheVersion}`);
