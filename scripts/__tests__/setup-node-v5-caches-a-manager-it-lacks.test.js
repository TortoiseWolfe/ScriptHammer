/**
 * `setup-node@v5` fails a job that installs nothing (#1134 aftermath).
 *
 * WHAT HAPPENED. #1134 removed `pnpm install` and `pnpm run build` from `monitor.yml`'s
 * pwa-tests, because the build could not affect what the job asserted. That was correct and it
 * broke the job: **`actions/setup-node@v5` defaults `package-manager-cache: true`**, detects
 * pnpm from `packageManager`/the lockfile, and then fails with
 *
 *     Unable to locate executable file: pnpm
 *
 * because nothing installed pnpm. Four consecutive `Monitor and Update Status` runs went red
 * before anyone looked — 17:54, 18:35, 19:06 and 20:00 on 2026-09-09. Removing the explicit
 * `cache: 'pnpm'` was NOT enough; the default has to be turned off.
 *
 * `setup-node@v4` does not do this, which is the whole reason `prod-schema-drift.yml` has the
 * same shape and has been green the entire time. So this is a version-specific trap, and the
 * kind that only appears when a job stops installing dependencies — a change that otherwise
 * looks purely subtractive and safe.
 *
 * WHY A GUARD. The failure is in a scheduled workflow nobody watches, it does not block merges,
 * and the message names pnpm rather than the caching that asked for it. It was found only
 * because a NEW workflow with the same shape was dispatched by hand on the day it shipped.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.resolve(__dirname, '..', '..', '.github', 'workflows');

/** Full-line YAML comments removed, so this cannot match its own explanation. */
function stripComments(src) {
  return src
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
}

/**
 * Every `actions/setup-node@v5` step, with the `with:` block that follows it and the job text
 * around it. Returns one entry per step.
 */
function v5Steps() {
  const out = [];
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.yml'))) {
    const src = stripComments(fs.readFileSync(path.join(DIR, file), 'utf8'));
    const re = /uses:\s*actions\/setup-node@v5/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      // The step's own `with:` block: everything until the next step (`- ` at any indent).
      const rest = src.slice(m.index);
      const nextStep = rest.slice(1).search(/\n\s*-\s+(uses|name|run):/);
      const block = nextStep === -1 ? rest : rest.slice(0, nextStep + 1);
      // Does anything in this JOB install pnpm? Look at a generous window around the step,
      // because the install may precede or follow it.
      const around = src.slice(
        Math.max(0, m.index - 1200),
        Math.min(src.length, m.index + 2500)
      );
      out.push({
        file,
        block,
        installsPnpm:
          /pnpm\/action-setup/.test(around) || /pnpm install/.test(around),
        cacheDisabled: /package-manager-cache:\s*false/.test(block),
      });
    }
  }
  return out;
}

describe('setup-node@v5 does not cache a package manager the job lacks', () => {
  it('finds v5 steps to check, so the sweep is not vacuous', () => {
    const steps = v5Steps();
    assert.ok(
      steps.length >= 3,
      `only ${steps.length} setup-node@v5 step(s) found — the parser is broken, not the workflows`
    );
  });

  it('every job that installs nothing turns the cache OFF', () => {
    const offenders = v5Steps()
      .filter((s) => !s.installsPnpm && !s.cacheDisabled)
      .map((s) => s.file);

    assert.deepStrictEqual(
      [...new Set(offenders)],
      [],
      'A job uses `actions/setup-node@v5`, installs no dependencies, and does not set ' +
        '`package-manager-cache: false`.\n\n' +
        'v5 defaults that to TRUE, detects pnpm from `packageManager`, and fails the step ' +
        'with `Unable to locate executable file: pnpm`. Removing an explicit `cache: pnpm` ' +
        'is NOT enough — the default must be turned off. This reddened four consecutive ' +
        '`Monitor and Update Status` runs on 2026-09-09.\n\n' +
        `Offending workflow(s): ${[...new Set(offenders)].join(', ')}`
    );
  });

  it('CONTROL: the parser can tell an installing job from a non-installing one', () => {
    // Without this, a parser that reported `installsPnpm: true` for everything would make the
    // assertion above pass over any number of broken jobs.
    const steps = v5Steps();
    assert.ok(
      steps.some((s) => s.installsPnpm),
      'no v5 step was seen to install pnpm — the detector is stuck on false'
    );
    assert.ok(
      steps.some((s) => !s.installsPnpm),
      'every v5 step was seen to install pnpm — the detector is stuck on true, so the rule ' +
        'above can never fire'
    );
  });
});
