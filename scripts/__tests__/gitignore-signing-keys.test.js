/**
 * Signing material must be ignored by pattern, not by luck (#1084).
 *
 * `*.pem` has been in `.gitignore` since the CRA days. The formats an iOS release
 * actually uses were not: an App Store Connect API key is a `.p8`, a provisioning
 * profile is a `.mobileprovision`, and certificates arrive as `.cer` or `.p12`.
 *
 * gitleaks runs pre-commit with `useDefault = true`, so a pasted PKCS#8 *body* would
 * very likely be caught. That is content scanning; this is the file rule, and the two
 * fail in different ways. Nothing stopped `git add -A` from staging the file itself.
 *
 * WHY `--no-index`. `git check-ignore` is index-aware: for a file that is already
 * TRACKED it reports "not ignored" even when a matching rule exists, which is how
 * `public/manifest.json` sat ignored-on-paper and tracked-in-fact for months. Only
 * `--no-index` answers the question this test is asking — does the RULE exist.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/** True when a rule in .gitignore matches this path, tracked or not. */
function ruleMatches(relPath) {
  const r = spawnSync('git', ['check-ignore', '--no-index', '-q', relPath], {
    cwd: ROOT,
  });
  // 0 = ignored, 1 = not ignored, anything else = git itself failed.
  assert.ok(
    r.status === 0 || r.status === 1,
    `git check-ignore failed for ${relPath}: status ${r.status} ${r.stderr}`
  );
  return r.status === 0;
}

describe('signing material is ignored by pattern (#1084)', () => {
  const MUST_IGNORE = [
    'AuthKey_ABC123XYZ.p8', // App Store Connect API private key
    'secrets/AuthKey.p8', // …in a subdirectory
    'ios.mobileprovision',
    'distribution.cer',
    'distribution.p12',
    'private.pem', // the rule that was already here
  ];

  for (const file of MUST_IGNORE) {
    it(`ignores ${file}`, () => {
      assert.ok(
        ruleMatches(file),
        `${file} is NOT ignored — add its extension to .gitignore. An API key or ` +
          'certificate left in the working tree can be staged by `git add -A`.'
      );
    });
  }

  it('does not ignore ordinary source files — the control', () => {
    // Anti-vacuity. A `*` rule, or a broken check-ignore invocation returning 0 for
    // everything, would make every assertion above pass while ignoring the repo.
    for (const ordinary of [
      'src/app/page.tsx',
      'scripts/generate-manifest.js',
      'README.md',
    ]) {
      assert.ok(
        !ruleMatches(ordinary),
        `${ordinary} is ignored, which means the patterns above prove nothing`
      );
    }
  });
});
