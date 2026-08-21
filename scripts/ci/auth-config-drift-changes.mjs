#!/usr/bin/env node
/**
 * Decide whether a change needs the auth-config drift check to run (#870).
 *
 * WHY THIS EXISTS. `auth-config-drift.yml` used to carry a trigger `paths:` filter, so it
 * reported nothing on an unrelated PR — and a required check that never reports is
 * **pending forever**, not skipped. It therefore could not be required, which is the
 * defect #572 catalogued and #869 fixed for Conformance.
 *
 * IT DOES NOT INCREASE LIVE API CALLS. This gates the drift job on exactly the paths the
 * old filter named, so an unrelated PR still makes no call against the live Supabase
 * project; only the trivial aggregate runs. The daily cron is unaffected.
 *
 * USAGE
 *   node scripts/ci/auth-config-drift-changes.mjs <base-sha> <head-sha>
 *   node scripts/ci/auth-config-drift-changes.mjs --files a.md b.ts
 *   node scripts/ci/auth-config-drift-changes.mjs --selftest
 */

import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Paths whose change can alter what the drift check observes.
 *
 * Wider than the filter it replaces. The old list named the desired-state JSON and the
 * script that applies it — but the check compares the LIVE project against that state,
 * so anything that changes what "desired" means, or how the comparison is made, can
 * change the verdict. `.env.example` is included because #734 documents fork overrides
 * for these values there, and a fork editing them is precisely who needs the check.
 */
export const DRIFT_PATHS = [
  'scripts/supabase/',
  'scripts/ci/auth-config-drift-changes.mjs',
  'tests/unit/auth-config-validity.test.ts',
  '.env.example',
  '.github/workflows/auth-config-drift.yml',
];

/** True when any changed file is one this check's verdict can depend on. */
export function needsDriftCheck(files) {
  return files.some((f) =>
    DRIFT_PATHS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p))
  );
}

function changedFiles(base, head) {
  return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

function main(argv) {
  if (argv.includes('--selftest')) {
    // A decider that can only ever reach one answer is not a decider.
    const yes = needsDriftCheck(['scripts/supabase/auth-config.json']);
    const no = needsDriftCheck(['README.md', 'src/components/Button.tsx']);
    const env = needsDriftCheck(['.env.example']);
    if (!yes || no || !env) {
      console.error(`selftest FAILED: config=${yes} unrelated=${no} env=${env}`);
      process.exit(1);
    }
    console.log('selftest ok: yes to the auth config, no to unrelated code, yes to .env.example');
    return;
  }

  const flag = argv.indexOf('--files');
  const files = flag !== -1 ? argv.slice(flag + 1) : changedFiles(argv[0], argv[1]);
  const run = needsDriftCheck(files);
  console.log(
    `  ${files.length} changed file(s); drift check ${run ? 'REQUIRED' : 'not required'}`
  );
  if (!run) for (const f of files.slice(0, 10)) console.log(`    skip: ${f}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
