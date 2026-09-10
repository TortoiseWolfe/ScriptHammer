/**
 * The Edge Function type-check exists, runs, and cannot pass over nothing (#1153).
 *
 * Nothing had ever checked `supabase/functions/**`, because three exclusions stacked: vitest
 * excludes the directory, no workflow ran `deno check`, and tsconfig excludes it (correctly —
 * Deno vs Node). The first run found 21 errors on the money path, two of them real defects.
 *
 * This guards the guard. The specific way it would rot is the one this repo keeps meeting: the
 * sweep stops matching files and reports a clean run of zero functions.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ci', 'check-edge-functions.sh');
const WF = path.join(ROOT, '.github', 'workflows', 'edge-functions.yml');
const FN = path.join(ROOT, 'supabase', 'functions');

describe('Edge Functions are type-checked (#1153)', () => {
  it('the script exists and is executable', () => {
    assert.ok(fs.existsSync(SCRIPT), 'check-edge-functions.sh is gone');
    assert.ok(fs.statSync(SCRIPT).mode & 0o111, 'the script is not executable');
  });

  it('it refuses to pass when it checked nothing', () => {
    // THE FAILURE MODE THAT MATTERS. A moved directory or a changed glob would otherwise print
    // a clean sweep of zero functions — green, and meaningless. Same shape as every other
    // vacuous gate this repo has had to fix.
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.match(src, /checked" -eq 0/, 'the zero-functions guard is gone');
    assert.match(
      src,
      /no Edge Functions were checked/,
      'the zero-functions guard no longer errors'
    );
  });

  it('it pins the resolution mode, or three functions fail for the wrong reason', () => {
    // Without `--node-modules-dir=none`, Deno finds the APP's node_modules and fails
    // stripe-webhook, paypal-webhook and sweep-intake-orphans with an npm resolution error
    // about the Node app — nothing to do with the Deno code.
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.match(src, /--node-modules-dir=none/);
  });

  it('the workflow runs the same script a developer runs', () => {
    const wf = fs.readFileSync(WF, 'utf8');
    assert.match(
      wf,
      /check-edge-functions\.sh/,
      'the workflow no longer runs the script'
    );
    assert.match(wf, /denoland\/setup-deno/, 'the workflow has no deno');
  });

  it('every function directory has an entrypoint the sweep can find', () => {
    // Anti-vacuity from the other end: if the layout changed, the script would legitimately
    // find nothing and this names why.
    const dirs = fs
      .readdirSync(FN, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== '_shared');
    assert.ok(
      dirs.length > 10,
      `only ${dirs.length} function dirs found — layout changed?`
    );
    const missing = dirs
      .filter((d) => !fs.existsSync(path.join(FN, d.name, 'index.ts')))
      .map((d) => d.name);
    assert.deepStrictEqual(
      missing,
      [],
      'function dirs without index.ts are invisible to the sweep'
    );
  });
});
