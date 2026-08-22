/**
 * Every `NEXT_PUBLIC_*` the app reads must reach the build (#918, and the four in #917).
 *
 * THE GAP THIS CLOSES. `env-example-documents-what-code-reads.test.js` checks code → docs: every
 * `process.env.X` in `src/` must appear in `.env.example`. It says so at its own lines 18-21, and
 * it is one-directional by design. Nothing checked code → BUILD.
 *
 * So a variable could be read by the app, documented in `.env.example`, listed in the fork
 * checklist — and passed by no workflow. Four were in exactly that state: `GOOGLE_SITE_VERIFICATION`
 * (Search Console verification never shipped), `SITE_TWITTER_HANDLE` (twitter:site missing from
 * EVERY page), `CASHAPP_CASHTAG` and `CHIME_SIGN`. Each is read with a `|| ''` fallback, so it is
 * absent in production with no error anywhere, and setting a repo Variable would have changed
 * nothing — the name would sit in Settings looking configured while the bundle shipped an empty
 * string. That is the #396 shape in configuration rather than in CI.
 *
 * COMMENTS ARE STRIPPED BEFORE MATCHING. `deploy.yml` documents its deliberate omission as
 * `# NEXT_PUBLIC_BASE_PATH intentionally omitted - auto-detected from GITHUB_REPOSITORY`, and the
 * entries added by #917 carry comments naming their own variables. Matching raw text would report
 * a commented-out variable as passed — a guard that reads its own prose, which this repo has hit
 * four times.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const DEPLOY = path.join(ROOT, '.github', 'workflows', 'deploy.yml');

/**
 * Variables read by `src/` that deliberately do NOT reach the build.
 *
 * A RATCHET WITH REASONS, in the shape of `no-new-public-secrets.test.js`: **it may shrink, never
 * grow.** Adding an entry here is choosing to ship a variable that silently does nothing, which is
 * the defect this file exists to catch — so an addition needs a reason that survives review, not a
 * green run. A stale entry is also a failure below: if the code stops reading it, remove it.
 */
const EXEMPT = Object.freeze({
  NEXT_PUBLIC_BASE_PATH:
    'auto-detected from GITHUB_REPOSITORY at build time; deploy.yml carries this same note ' +
    'inline. Passing it would override the detection.',
  NEXT_PUBLIC_BACKEND_PROVIDER:
    'selects the messaging backend and defaults to "supabase" (src/config/backend.config.ts:37). ' +
    'Production IS supabase, so passing it is a no-op today. A fork switching backends must add ' +
    'it here AND to deploy.yml.',
  NEXT_PUBLIC_DOTNET_API_URL:
    'only read when the provider is "dotnet" (src/config/backend.config.ts:38). Dead weight in a ' +
    'supabase build; becomes required the moment BACKEND_PROVIDER changes.',
});

/** Every .ts/.tsx under src/ that is not a test. */
function sourceFiles(dir = SRC, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === '__mocks__') continue;
      sourceFiles(p, acc);
    } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const FILES = sourceFiles();

/** NEXT_PUBLIC_* actually dereferenced off process.env in non-test source. */
function readsInSource() {
  const found = new Set();
  for (const f of FILES) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
      found.add(m[1]);
    }
  }
  return found;
}

/** NEXT_PUBLIC_* keys deploy.yml actually assigns, comments removed. */
function passedByDeploy() {
  const noComments = fs
    .readFileSync(DEPLOY, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const found = new Set();
  // Match the SYNTAX of an env assignment — `KEY: ${{ ... }}` — not the bare name.
  for (const m of noComments.matchAll(
    /^\s+(NEXT_PUBLIC_[A-Z0-9_]+):\s*\$\{\{/gm
  )) {
    found.add(m[1]);
  }
  return found;
}

describe('deploy.yml passes every NEXT_PUBLIC_* the app reads (#918)', () => {
  it('the scans found something to compare', () => {
    // Anti-vacuity. A moved src/ or a reformatted workflow makes both sets empty and every
    // comparison below passes while inspecting nothing.
    assert.ok(
      FILES.length > 100,
      `scanned only ${FILES.length} source files — the walker is looking in the wrong place`
    );
    assert.ok(
      readsInSource().size >= 20,
      `found only ${readsInSource().size} NEXT_PUBLIC_* reads — the regex is stale`
    );
    assert.ok(
      passedByDeploy().size >= 25,
      `parsed only ${passedByDeploy().size} env entries from deploy.yml — the matcher is stale`
    );
  });

  it('every variable the app reads is passed, or explicitly exempt', () => {
    const missing = [...readsInSource()]
      .filter((v) => !passedByDeploy().has(v))
      .filter((v) => !(v in EXEMPT))
      .sort();
    assert.deepStrictEqual(
      missing,
      [],
      'these NEXT_PUBLIC_* values are read by src/ but passed by no workflow, so they are ' +
        'EMPTY in production and setting a repo Variable would change nothing:\n  ' +
        missing.join('\n  ') +
        '\nAdd each to deploy.yml as `${{ vars.NAME }}` (public by definition — vars, not ' +
        'secrets, per #787), or add an EXEMPT entry with a reason that survives review.'
    );
  });

  it('no exemption is stale — the ratchet only shrinks', () => {
    // An entry left behind after the code stops reading it turns the list into folklore, and the
    // next reader cannot tell a live exemption from a dead one.
    const reads = readsInSource();
    const dead = Object.keys(EXEMPT).filter((v) => !reads.has(v));
    assert.deepStrictEqual(
      dead,
      [],
      `these are exempted but no longer read by src/ — delete them from EXEMPT: ${dead.join(', ')}`
    );
  });

  it('no variable is both exempt and passed', () => {
    // A contradiction means one of the two is a lie, and the reason text is then misleading.
    const both = Object.keys(EXEMPT).filter((v) => passedByDeploy().has(v));
    assert.deepStrictEqual(
      both,
      [],
      `these are listed as deliberately omitted but deploy.yml passes them: ${both.join(', ')}`
    );
  });

  it('the four from #917 are actually wired', () => {
    // Named explicitly. The general assertion above would also catch their removal, but this one
    // says WHICH incident regressed, which is what a future reader needs.
    const passed = passedByDeploy();
    for (const v of [
      'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION',
      'NEXT_PUBLIC_SITE_TWITTER_HANDLE',
      'NEXT_PUBLIC_CASHAPP_CASHTAG',
      'NEXT_PUBLIC_CHIME_SIGN',
    ]) {
      assert.ok(
        passed.has(v),
        `${v} is no longer passed by deploy.yml (#917 regressed)`
      );
    }
  });

  it('CONTROL: comment stripping works, and a commented var does not count as passed', () => {
    // deploy.yml really does contain `# NEXT_PUBLIC_BASE_PATH intentionally omitted ...`.
    // If the stripper broke, BASE_PATH would read as passed and contradict its own exemption.
    const raw = fs.readFileSync(DEPLOY, 'utf8');
    assert.match(
      raw,
      /#\s*NEXT_PUBLIC_BASE_PATH intentionally omitted/,
      'the inline note about BASE_PATH is gone — this control no longer proves anything'
    );
    assert.ok(
      !passedByDeploy().has('NEXT_PUBLIC_BASE_PATH'),
      'a COMMENTED-OUT variable was counted as passed — the matcher is reading prose'
    );
  });

  it('CONTROL: the comparison reports a variable that is missing', () => {
    // Without this, an always-empty `missing` would satisfy the main assertion forever.
    const reads = new Set(['NEXT_PUBLIC_SOMETHING_NOBODY_PASSES']);
    const missing = [...reads]
      .filter((v) => !passedByDeploy().has(v))
      .filter((v) => !(v in EXEMPT));
    assert.deepStrictEqual(
      missing,
      ['NEXT_PUBLIC_SOMETHING_NOBODY_PASSES'],
      'the comparison did not flag a variable that no workflow passes'
    );
  });
});
