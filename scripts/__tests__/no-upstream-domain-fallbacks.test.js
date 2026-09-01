/**
 * No live check may fall back to this repo's own domain (#1054).
 *
 * WHY IT EXISTS. ScriptHammer is a template, so every hardcoded default is a fork pointing at
 * the owner's infrastructure. The class has now been found five times — #1014 (a fork's comments
 * posted against the template's domain), #987 (a PageSpeed gate), and #822/#393 (the mail and CSP
 * checkers) — and #1054 found three more that survived all of those fixes.
 *
 * The sharpest was `check-retained-assets.mjs`, the unstyled-production detector. Run by a fork
 * with nothing configured it printed:
 *
 *     base      https://scripthammer.com
 *     manifest  239 entries
 *     MISSING   0
 *     OK — every asset the deploy promised to retain is still served.
 *
 * A green detector, measuring a different host. Reproduced exactly before the fix.
 *
 * WHY A FILE-LEVEL SWEEP AND NOT THREE ASSERTIONS. Each instance had already been fixed
 * elsewhere in the same family, and the next one was always written by someone following the
 * shape of an existing script. The `smoke.yml` case is the proof: the identical fix, with a
 * comment explaining it, sat twelve lines below the step that still had the bug. A guard that
 * names three files would be satisfied while a fourth is added. This one sweeps.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/** This repo's own identity, which no default may name. */
const OWN_DOMAIN = /scripthammer\.com/i;

/**
 * Files that may legitimately name the domain.
 *
 * Each entry is a REASON, not a suppression: a test fixture that pins this repo's own published
 * policy, or seed data. If a new entry is needed, it needs a reason of the same kind.
 */
const ALLOWED = [
  // Asserts THIS repo's published security address actually receives (#881). Naming the domain
  // is the entire point of the check.
  'scripts/__tests__/security-policy-reachable.test.js',
  // Test fixtures pinning canonical output for a known origin.
  'scripts/__tests__/check-canonicals.test.js',
  'scripts/__tests__/no-upstream-domain-fallbacks.test.js',
  // Local seed identities for the dev/test admin user, not a network target.
  'scripts/reset-database.ts',
  'scripts/seed-test-users.ts',
  // A rendered UI example value in a design artifact.
  'scripts/design-sync/manifest.js',
  // Deliberate, and already solved: FORK_OVERRIDABLE in auth-config-loader.js names all eight
  // fork-overridable keys, so `${AUTH_SITE_URL:-…}` is a documented default with an escape (#734).
  'scripts/supabase/auth-config.json',
];

/** Strip comments so a guard cannot match its own prose — this repo has been bitten four times. */
function codeOf(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*(\/\/|#).*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), {
    withFileTypes: true,
  })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(rel, out);
    } else if (/\.(mjs|js|ts|json|yml|yaml)$/.test(e.name)) {
      out.push(rel);
    }
  }
  return out;
}

describe("no live check falls back to this repo's domain (#1054)", () => {
  it('finds files to scan, so the sweep is not vacuous', () => {
    const files = [...walk('scripts'), ...walk('.github/workflows')];
    assert.ok(
      files.length > 50,
      `only ${files.length} files scanned — the walk is broken`
    );
  });

  it('names no upstream domain in scripts/ or the workflows', () => {
    const offenders = [];
    for (const file of [...walk('scripts'), ...walk('.github/workflows')]) {
      if (ALLOWED.includes(file)) continue;
      const code = codeOf(file);
      for (const [i, line] of code.split('\n').entries()) {
        if (OWN_DOMAIN.test(line))
          offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`);
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      'a fork running these would measure THIS repo:\n' + offenders.join('\n')
    );
  });
});

describe('the three #1054 checks handle an absent base explicitly', () => {
  // Each must have a BRANCH for the empty case. A bare deletion of the literal is not enough:
  // check-retained-assets.mjs then built a relative URL and died with `ERR_INVALID_URL` and a
  // stack trace naming no variable and no remedy.
  const CASES = [
    [
      'scripts/ci/check-retained-assets.mjs',
      /if \(!BASE\)/,
      /process\.exit\(0\)/,
      'skips',
    ],
    [
      'scripts/retain-previous-assets.mjs',
      /if \(!BASE\)/,
      /process\.exit\(0\)/,
      'skips',
    ],
    [
      'scripts/check-captcha.mjs',
      /if \(!BASE\)/,
      /process\.exit\(2\)/,
      'refuses',
    ],
  ];

  for (const [file, branch, exit, verb] of CASES) {
    it(`${file} ${verb} on an empty base`, () => {
      const code = codeOf(file);
      const m = branch.exec(code);
      assert.ok(m, `${file} has no empty-base branch`);
      // SCOPED TO THE BRANCH, not the file. Matching the exit code anywhere was vacuous and a
      // mutation proved it: check-captcha.mjs has a sibling SITE_KEY guard that also exits 2,
      // so flipping the empty-base branch to exit 0 — the whole failure being guarded against —
      // left this assertion green. Same shape as the `MENU_ITEM` guard in #547.
      const body = code.slice(
        m.index,
        code.indexOf('}', code.indexOf('process.exit', m.index))
      );
      assert.match(
        body,
        exit,
        `${file}'s empty-base branch has the wrong exit code:\n${body}`
      );
    });
  }

  it('the retention skip still publishes a manifest', () => {
    // publishManifest() is documented as called on EVERY exit path including failures: skipping
    // without it ships a manifest-less build, and the NEXT deploy then finds nothing to read and
    // falls back to crawling HTML, which finds a third of the files. One misconfiguration, two
    // degraded deploys.
    const code = codeOf('scripts/retain-previous-assets.mjs');
    const i = code.indexOf('if (!BASE)');
    const j = code.indexOf('process.exit(0)', i);
    assert.ok(i > 0 && j > i, 'empty-base branch not found');
    assert.match(
      code.slice(i, j),
      /await publishManifest\(\)/,
      'the skip exits without publishing a manifest'
    );
  });

  it('the workflows pass the variable through with no `:-` fallback', () => {
    for (const [wf, script] of [
      ['.github/workflows/smoke.yml', 'check-retained-assets.mjs'],
      ['.github/workflows/deploy.yml', 'retain-previous-assets.mjs'],
    ]) {
      const yml = fs.readFileSync(path.join(ROOT, wf), 'utf8');
      const i = yml.indexOf(script);
      assert.ok(i > 0, `${wf} no longer runs ${script}`);
      const line = yml.slice(
        yml.lastIndexOf('\n', i) + 1,
        yml.indexOf('\n', i)
      );
      assert.doesNotMatch(
        line,
        /:-/,
        `${wf} still has a \`:-\` fallback on the ${script} line`
      );
    }
  });
});
