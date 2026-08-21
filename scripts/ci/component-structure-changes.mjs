#!/usr/bin/env node
/**
 * Decide whether a change needs the component-structure suite to run (#870).
 *
 * WHY THIS EXISTS AND NOT A TRIGGER `paths:` FILTER. `component-structure.yml` used to
 * carry one, which means it reports NOTHING on an unrelated PR — and a required check
 * that never reports is **pending forever**, not skipped. CLAUDE.md names
 * `Validate Component Structure` as one of the checks that therefore cannot be required,
 * which is the defect #572 catalogued and #869 fixed for Conformance.
 *
 * The trigger is now unfiltered, this decides inside the workflow, and the `result` job
 * reports success when the suite was legitimately skipped.
 *
 * USAGE
 *   node scripts/ci/component-structure-changes.mjs <base-sha> <head-sha>
 *   node scripts/ci/component-structure-changes.mjs --files a.md b.tsx
 *   node scripts/ci/component-structure-changes.mjs --selftest
 */

import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Paths whose change can alter what the validator observes.
 *
 * WIDER than the trigger filter it replaces, on purpose. The old filter listed
 * `src/components/**` and the script itself — but the validator's verdict also depends on
 * the RULES it applies and the SCAFFOLD that produces compliant components:
 *
 *   - `scripts/audit-components.js` carries KNOWN_BARE_COMPONENTS, the allowlist that
 *     decides what counts as compliant at all.
 *   - `plopfile.js` and `tools/templates/` generate the five-file structure; a template
 *     change can make every newly scaffolded component non-compliant without touching a
 *     single file under src/components.
 *   - the structure tests themselves.
 */
export const STRUCTURE_PATHS = [
  'src/components/',
  'scripts/validate-structure.js',
  'scripts/audit-components.js',
  'scripts/ci/component-structure-changes.mjs',
  'scripts/__tests__/validate-structure.test.js',
  'scripts/__tests__/audit-components.test.js',
  'plopfile.js',
  'tools/templates/',
  '.github/workflows/component-structure.yml',
];

/** True when any changed file is one this suite's verdict can depend on. */
export function needsStructureCheck(files) {
  return files.some((f) =>
    STRUCTURE_PATHS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p))
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
    // A decider that can only ever say one thing is the defect this repo keeps paying
    // for. Prove both directions before trusting either.
    const yes = needsStructureCheck(['src/components/atomic/Button/Button.tsx']);
    const no = needsStructureCheck(['README.md', 'docs/thing.md']);
    const tpl = needsStructureCheck(['plopfile.js']);
    if (!yes || no || !tpl) {
      console.error(`selftest FAILED: component=${yes} docs=${no} plopfile=${tpl}`);
      process.exit(1);
    }
    console.log('selftest ok: yes to a component, no to docs, yes to the generator');
    return;
  }

  const flag = argv.indexOf('--files');
  const files = flag !== -1 ? argv.slice(flag + 1) : changedFiles(argv[0], argv[1]);
  const run = needsStructureCheck(files);
  console.log(
    `  ${files.length} changed file(s); structure validation ${run ? 'REQUIRED' : 'not required'}`
  );
  if (!run) for (const f of files.slice(0, 10)) console.log(`    skip: ${f}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
