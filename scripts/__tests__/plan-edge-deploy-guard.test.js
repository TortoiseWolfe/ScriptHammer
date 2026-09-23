/**
 * The edge-deploy planner stays a planner, and stays credential-free (#1188).
 *
 * Behaviour of the closure itself is covered by `tests/unit/edge-function-closure.test.ts`
 * (vitest, because `node --test` cannot import TypeScript). This file guards the WIRING —
 * the properties that make the planner safe to run and useless as a deploy tool:
 *
 *   - it refuses `--apply` BY NAME, so its absence reads as a decision rather than an
 *     unfinished feature somebody helpfully completes;
 *   - it needs no credential, so planning can never be the thing that touches production;
 *   - the closure matches SPECIFIERS, not the `import` keyword — the regression that would
 *     silently reintroduce the four-instead-of-five hand count this ticket exists for.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PLANNER = path.join(ROOT, 'scripts', 'supabase', 'plan-edge-deploy.ts');
const CLOSURE = path.join(ROOT, 'scripts', 'lib', 'edge-function-closure.ts');

/** Source with comments stripped, so nothing matches its own rationale. */
function code(file) {
  assert.ok(
    fs.existsSync(file),
    `${file} is gone — re-point this guard (#1188)`
  );
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('edge-deploy planner (#1188)', () => {
  it('is wired as a pnpm script beside the other supabase tools', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    );
    assert.match(
      pkg.scripts['supabase:plan-edge'] ?? '',
      /plan-edge-deploy\.ts/,
      'package.json must expose the planner, or it is a file nobody runs'
    );
  });

  it('refuses --apply by name, so its absence is a decision and not a gap', () => {
    const src = code(PLANNER);
    assert.match(
      src,
      /--apply/,
      'the planner must recognise --apply in order to refuse it'
    );
    assert.match(
      src,
      /verify_jwt/,
      'the refusal must name WHY: the per-slug verify_jwt table does not exist in this repo, ' +
        'and guessing it 401s a live provider or removes the JWT gate from a money endpoint.'
    );
    assert.doesNotMatch(
      src,
      /functions\/deploy/,
      'the planner must not contain a deploy endpoint. If uploading is added, it needs its ' +
        'own review — not to arrive inside a tool named "plan".'
    );
  });

  it('and actually EXITS non-zero on --apply, not merely mentions it', () => {
    // The source assertions above passed with the refusal disabled (`if (false)`), because
    // both strings stayed in the file. Presence of the words is not the behaviour. Run it.
    const res = spawnSync(
      'node',
      ['--import', 'tsx', PLANNER, '--slug', 'stripe-webhook', '--apply'],
      { cwd: ROOT, encoding: 'utf8', timeout: 120_000 }
    );
    assert.notStrictEqual(
      res.status,
      null,
      `planner did not run: ${res.stderr?.slice(0, 300)}`
    );
    assert.notStrictEqual(
      res.status,
      0,
      'the planner exited 0 for --apply. Uploading to a live Edge Function on the money ' +
        'path must never be reachable from a tool named "plan" (#1188).'
    );
  });

  it('matches import SPECIFIERS, never the `import` keyword', () => {
    // THE REGRESSION THIS EXISTS FOR. `^import\s.*from '…'` misses
    // `} from '../_shared/webhook-types.ts';` on a continuation line, which is exactly how
    // stripe-webhook was hand-counted as four files instead of five.
    const src = code(CLOSURE);
    assert.doesNotMatch(
      src,
      /\^import\\s/,
      'the closure regex must not be anchored to a line starting with `import` — three ' +
        'imports in this repo today hide behind a line break (#1188).'
    );
    assert.match(
      src,
      /from\\s\+\['"\]/,
      'the closure must match a `from` specifier wherever it appears'
    );
  });

  it('plans with no Supabase credential in the environment', () => {
    // Planning must never be the step that can touch production. Deleting the token proves
    // it: if the planner needed one, this fails rather than quietly reading .env.
    const env = { ...process.env };
    delete env.SUPABASE_ACCESS_TOKEN;
    delete env.SUPABASE_SERVICE_ROLE_KEY;

    const res = spawnSync(
      'node',
      ['--import', 'tsx', PLANNER, '--slug', 'stripe-webhook'],
      { cwd: ROOT, encoding: 'utf8', env, timeout: 120_000 }
    );

    // Could-not-run is not a pass: if tsx is missing say so, do not skip.
    assert.notStrictEqual(
      res.status,
      null,
      `planner did not run to completion: ${res.stderr?.slice(0, 300)}`
    );
    assert.strictEqual(
      res.status,
      0,
      `planning stripe-webhook from origin/main should succeed with no credential.\n` +
        `${res.stdout}\n${res.stderr}`.slice(0, 600)
    );
    assert.match(
      res.stdout,
      /5 file\(s\)/,
      'stripe-webhook is five files — the count a human got wrong (#1188)'
    );
  });
});
