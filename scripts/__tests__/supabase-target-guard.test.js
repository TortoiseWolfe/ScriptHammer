/**
 * The service-role guard is WIRED IN (#877).
 *
 * WHAT HAPPENED. On 2026-08-21 `pnpm run seed:local` wrote to the **cloud** project and gave
 * every account in it an `accepted` connection to every other account — which is the messaging
 * authorization itself, not a pending request. ~18 of those accounts belong to real people. It
 * was reverted the same hour, but nothing in the path had said "cloud": the script name said
 * local, and the resolved URL was never printed.
 *
 * WHAT THIS PINS — wiring only, the parts not reachable from an import:
 *   1. Every script that holds the service-role key actually calls the guard.
 *   2. The destructive script names its target inside its confirmation prompt.
 *   3. The shell wrapper forwards the target into its `docker compose exec` calls — the
 *      mechanism that made the incident possible, because each exec takes the CONTAINER's
 *      environment and silently discards the caller's.
 *   4. package.json declares an honest local entry point and a separate cloud one.
 *
 * THE RULES THEMSELVES are tested by behaviour in `tests/unit/supabase-target.test.ts`,
 * which can import the TypeScript and call `classify()` and `decide()` for real. An earlier
 * version of this file asserted on the module's SOURCE TEXT and broke the moment the
 * pre-commit `prettier --write` reformatted a return statement — it was checking the
 * spelling of the rule rather than the rule.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE = path.join(ROOT, 'scripts', 'lib', 'supabase-target.ts');
const WRAPPER = path.join(ROOT, 'scripts', 'setup-e2e-users.sh');
const PKG = path.join(ROOT, 'package.json');

/** Scripts that hold the service-role key and write. Each must call the guard. */
const GUARDED = [
  'seed-test-users.ts',
  'seed-connections.ts',
  'seed-encrypted-messages.ts',
  'reset-database.ts',
  'create-test-conversation.ts',
  'initialize-test-keys.ts',
];

const read = (p) => fs.readFileSync(p, 'utf8');

describe('the Supabase target guard (#877)', () => {
  it('reads the module it is about', () => {
    // Non-vacuity: every assertion below is over this text.
    assert.ok(fs.existsSync(MODULE), `guard module missing at ${MODULE}`);
    assert.ok(read(MODULE).length > 500, 'guard module is suspiciously short');
  });

  it('every service-role script calls the guard', () => {
    for (const name of GUARDED) {
      const p = path.join(ROOT, 'scripts', name);
      assert.ok(
        fs.existsSync(p),
        `${name} not found — update this list or the script moved`
      );
      assert.match(
        read(p),
        /requireApprovedTarget\(/,
        `${name} holds the service-role key but never announces or gates its target`
      );
    }
  });

  it('the destructive script names its target inside the confirmation', () => {
    const src = read(path.join(ROOT, 'scripts', 'reset-database.ts'));
    // It always asked "are you sure". It never said "sure about WHAT" — and someone
    // typing RESET while believing they are on localhost is the entire failure mode.
    assert.match(
      src,
      /About to delete all user data from \$\{where\}/,
      'the RESET prompt does not name the database it is about to destroy'
    );
    assert.match(
      src,
      /REMOTE project/,
      'the prompt does not distinguish remote from local'
    );
  });

  it('the shell wrapper forwards the target into the container', () => {
    const src = read(WRAPPER);
    // `docker compose exec` takes the CONTAINER's environment. Setting a variable in the
    // calling shell has NO effect on the seeders — that is precisely how the wrong project
    // got written to while the caller believed they had pointed it at local.
    assert.match(
      src,
      /SUPABASE_ADMIN_URL=\$\{SUPABASE_ADMIN_URL\}/,
      'target not forwarded'
    );
    assert.match(
      src,
      /ALLOW_REMOTE_SUPABASE=\$\{ALLOW_REMOTE_SUPABASE\}/,
      'override not forwarded'
    );
    const execs =
      src.match(/docker compose exec [^\n]*tsx scripts\/seed-/g) ?? [];
    assert.equal(
      execs.length,
      2,
      `expected 2 seeder execs, found ${execs.length}`
    );
    for (const line of execs) {
      assert.match(
        line,
        /\$\{FORWARD\[@\]\}/,
        `an exec does not forward the target: ${line}`
      );
    }
  });

  it('seed:local actually points at local, and cloud is a separate named script', () => {
    const pkg = JSON.parse(read(PKG));
    assert.match(
      pkg.scripts['seed:local'],
      /SUPABASE_ADMIN_URL=\$\{SUPABASE_ADMIN_URL:-http:\/\/supabase-kong:8000\}/,
      'seed:local does not default to the local stack — the name still lies'
    );
    assert.ok(
      pkg.scripts['seed:cloud'],
      'there is no separately named seed:cloud, so cloud seeding has no honest entry point'
    );
    assert.ok(
      !/supabase-kong/.test(pkg.scripts['seed:cloud']),
      'seed:cloud must not pin the local host'
    );
  });
});
