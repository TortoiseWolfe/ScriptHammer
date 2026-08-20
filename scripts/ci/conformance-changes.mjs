#!/usr/bin/env node
/**
 * Decide whether a change needs the Conformance suite to run (#572 item 6).
 *
 * WHY THIS EXISTS AND NOT A TRIGGER `paths:` FILTER. `conformance.yml` used to carry a
 * `paths:` filter, which means it reports NOTHING on an unrelated PR — and a required
 * check that never reports is **pending forever**, not skipped. So it could not be made
 * required, and on 2026-08-18 it was red on every push from `e0add554` to `007a60de` —
 * six merges — while all three required checks stayed green, because none of them runs
 * `pnpm test:rls`.
 *
 * The trigger is now unfiltered, this decides inside the workflow, and the `result` job
 * reports success when the suite was legitimately skipped. Same shim that made
 * `e2e-local.yml` requirable.
 *
 * THE LIST LIVES HERE, ONCE. `e2e-local-changes.mjs` derives its list from `e2e.yml`
 * because two lanes cover the same subject; this suite has no twin, so the list is
 * authored here and the workflow carries none. One place, so they cannot disagree.
 *
 * USAGE
 *   node scripts/ci/conformance-changes.mjs <base-sha> <head-sha>  # writes run=… to GITHUB_OUTPUT
 *   node scripts/ci/conformance-changes.mjs --files a.md b.ts      # decide over an explicit list
 *   node scripts/ci/conformance-changes.mjs --selftest             # prove it can say both
 */

import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Paths whose change can alter what the conformance suite observes.
 *
 * Deliberately WIDER than the old trigger filter in two places, both learned from the
 * six-merge outage:
 *
 *   - `scripts/supabase/**` and `supabase/functions/**` — the suite runs against a real
 *     local stack, so anything that provisions or privileges that stack can change its
 *     verdict. #565 was exactly this: a one-line grant change moved a refusal from RLS
 *     (`data: []`) to the privilege layer (`42501`), and the test asserted the mechanism
 *     rather than the property.
 *   - `package.json` / lockfile — a dependency bump can change client behaviour under
 *     test without touching a single listed source path.
 */
export const CONFORMANCE_PATHS = [
  'supabase/migrations/',
  'supabase/functions/',
  'scripts/supabase/',
  'scripts/ci/conformance-changes.mjs',
  'src/services/messaging/',
  'src/config/backend.config.ts',
  'dotnet-messaging/',
  'tests/rls/',
  'tests/contract/',
  'tests/fixtures/test-users.ts',
  'vitest.rls.config.ts',
  'docker-compose.yml',
  'package.json',
  'pnpm-lock.yaml',
  '.github/workflows/conformance.yml',
];

/** True when any changed file is one this suite's verdict can depend on. */
export function needsConformance(files) {
  return files.some((f) =>
    CONFORMANCE_PATHS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p))
  );
}

function changedFiles(base, head) {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `${base}...${head}`],
    { encoding: 'utf8' }
  );
  return out.split('\n').filter(Boolean);
}

function main(argv) {
  if (argv.includes('--selftest')) {
    // A decider that can only ever say one thing is the defect this repo keeps paying
    // for. Prove both directions before trusting either.
    const yes = needsConformance(['supabase/migrations/20251006_x.sql']);
    const no = needsConformance(['README.md', 'docs/thing.md']);
    const dep = needsConformance(['pnpm-lock.yaml']);
    if (!yes || no || !dep) {
      console.error(
        `selftest FAILED: migration=${yes} docs=${no} lockfile=${dep}`
      );
      process.exit(1);
    }
    console.log('selftest ok: says yes to a migration, no to docs, yes to a lockfile');
    return;
  }

  const fileFlag = argv.indexOf('--files');
  const files =
    fileFlag !== -1 ? argv.slice(fileFlag + 1) : changedFiles(argv[0], argv[1]);

  const run = needsConformance(files);
  console.log(`  ${files.length} changed file(s); conformance ${run ? 'REQUIRED' : 'not required'}`);
  if (!run) {
    for (const f of files.slice(0, 10)) console.log(`    skip: ${f}`);
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
