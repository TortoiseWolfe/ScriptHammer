/**
 * The pre-push validation build must not rewrite the tracked manifest (#1114).
 *
 * WHAT WENT WRONG. `public/manifest.json` is tracked on purpose (#392) so its paths are
 * reviewable. `.husky/pre-push` runs `scripts/validate-ci.sh`, which runs a production build
 * in the `builder` container; that container takes `env_file: .env` and so inherits
 * `NEXT_PUBLIC_BASE_PATH`. For a custom-domain deploy that differs from what the site
 * actually serves, so the generator rewrote `start_url`, `scope` and every icon path in a
 * tracked file — on EVERY push.
 *
 * Observed five times in one session. Each time it was caught only because someone read
 * `gh pr create`'s "1 uncommitted change" warning. Attention is not a mechanism, and
 * committing it ships a manifest that breaks PWA install and offline.
 *
 * WHY THE FIX IS HERE AND NOT IN THE GENERATOR. The first attempt taught
 * `generate-manifest.js` to refuse when the build's base path diverged from the deployed one.
 * That broke the rebrand harness, and correctly so: a rebrand LEGITIMATELY regenerates this
 * file with a diverging base path, which is the whole point of #985 —
 * `tests/rebrand/test-rebrand.sh` asserts a fork gets `/widget-works/`. The generator cannot
 * distinguish an intentional regeneration from an accidental one; the CALLER can, and the
 * pre-push gate knows it only needs the build to succeed.
 *
 * `MANIFEST_OUTPUT_DIR` is the existing seam, added by #931 for this exact class.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const SCRIPT = path.resolve(__dirname, '..', 'validate-ci.sh');

/** The build lines, with shell comments removed so this cannot match its own rationale. */
function buildLines() {
  return fs
    .readFileSync(SCRIPT, 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .filter((l) => /Production build/.test(l));
}

describe('pre-push validation build writes its manifest to scratch (#1114)', () => {
  it('finds the production-build invocations, so the check is not vacuous', () => {
    const lines = buildLines();
    assert.ok(
      lines.length >= 2,
      `expected both the in-container and host-Docker build lines, found ${lines.length}. ` +
        'If validate-ci.sh was restructured, re-point this guard rather than deleting it.'
    );
  });

  it('every production build redirects MANIFEST_OUTPUT_DIR', () => {
    const offenders = buildLines().filter(
      (l) => !l.includes('MANIFEST_OUTPUT_DIR')
    );
    assert.deepStrictEqual(
      offenders,
      [],
      'A production build in the pre-push gate does not set MANIFEST_OUTPUT_DIR, so it will ' +
        "rewrite the tracked public/manifest.json with this machine's base path and leave " +
        'the tree dirty on every push (#1114).\n\n' +
        `Offending line(s):\n  ${offenders.join('\n  ')}`
    );
  });

  it('the generator still honours the seam it depends on', () => {
    // The guard above is worthless if MANIFEST_OUTPUT_DIR stops being read. Asserting the
    // generator still implements it keeps the two halves from drifting apart silently —
    // which is the failure mode where a gate keeps passing while the thing it gates is gone.
    const gen = fs.readFileSync(
      path.resolve(__dirname, '..', 'generate-manifest.js'),
      'utf8'
    );
    const code = gen
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.match(
      code,
      /process\.env\.MANIFEST_OUTPUT_DIR/,
      'generate-manifest.js no longer reads MANIFEST_OUTPUT_DIR, so redirecting it in ' +
        'validate-ci.sh does nothing and the pre-push build is dirtying the tree again (#931, #1114).'
    );
  });
});
