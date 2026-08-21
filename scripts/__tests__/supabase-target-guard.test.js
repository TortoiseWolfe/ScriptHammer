/**
 * A script holding the service-role key must announce its target and refuse a remote one (#877).
 *
 * WHAT HAPPENED. On 2026-08-21 `pnpm run seed:local` wrote to the **cloud** project and gave
 * every account in it an `accepted` connection to every other account — which is the messaging
 * authorization itself, not a pending request. ~18 of those accounts belong to real people. It
 * was reverted the same hour, but nothing in the path had said "cloud": the script name said
 * local, and the resolved URL was never printed.
 *
 * WHAT THIS PINS.
 *   1. The classifier calls the local stack local by every route it is reached (published
 *      port, compose service name, docker host gateway) and everything else remote.
 *   2. An unparseable or missing URL is REMOTE / refused — failing safe means refusing.
 *   3. The remote override must NAME the host. A blanket `=1` would be exported once and
 *      forgotten, which is a flag that protects nothing.
 *   4. Every script that holds the service-role key actually calls the guard.
 *   5. The shell wrapper forwards the target into its `docker compose exec` calls — the
 *      mechanism that made the incident possible, because each exec takes the CONTAINER's
 *      environment and silently discards the caller's.
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

/**
 * The module is TypeScript, so exercise its RULES against the real source rather than a
 * reimplementation: re-deriving the host list here would let the two drift, and the copy in
 * the test would keep passing while the real one broke.
 */
function loadRules() {
  const src = read(MODULE);
  const hosts = [...src.matchAll(/^\s*'([^']+)',$/gm)]
    .map((m) => m[1])
    .filter((h) => /^[\w.:[\]-]+$/.test(h));
  return { src, hosts };
}

describe('the Supabase target guard (#877)', () => {
  it('reads the module it is about', () => {
    // Non-vacuity: every assertion below is over this text.
    assert.ok(fs.existsSync(MODULE), `guard module missing at ${MODULE}`);
    assert.ok(read(MODULE).length > 500, 'guard module is suspiciously short');
  });

  it('treats every route to the local stack as local', () => {
    const { hosts } = loadRules();
    // Three genuinely different routes, all of them the same local stack. Missing one
    // makes the guard refuse legitimate local work, which is how a guard gets disabled.
    for (const h of [
      '127.0.0.1',
      'localhost',
      'supabase-kong',
      'host.docker.internal',
    ]) {
      assert.ok(hosts.includes(h), `LOCAL_HOSTS is missing ${h}`);
    }
  });

  it('does not treat a supabase.co host as local', () => {
    const { hosts } = loadRules();
    assert.ok(
      !hosts.some((h) => h.endsWith('.supabase.co') || h === 'supabase.co'),
      'a hosted Supabase domain appears in LOCAL_HOSTS — that is the incident, encoded'
    );
  });

  it('refuses rather than guesses when nothing is set', () => {
    const { src } = loadRules();
    assert.match(
      src,
      /refusing rather than guessing/,
      'a missing URL must refuse; proceeding on an unset target is how this fails silently'
    );
    assert.match(
      src,
      /isLocal: false, label: '<unparseable>'/,
      'an unparseable URL must be treated as REMOTE, not waved through'
    );
  });

  it('requires the remote override to NAME the host', () => {
    const { src } = loadRules();
    assert.match(
      src,
      /allow === target\.host/,
      'ALLOW_REMOTE_SUPABASE must be compared to the hostname. A truthy flag gets ' +
        'exported once and forgotten, and then authorises every future run.'
    );
    assert.match(
      src,
      /the override must name the host it authorises/,
      'a mismatched override must say why it was rejected'
    );
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

  it('the URL CI seeds with is classified local', () => {
    // The required lane runs `pnpm tsx scripts/seed-test-users.ts` against its own
    // per-runner stack. If the guard stopped recognising that host, every PR would fail
    // at seeding — so the two are pinned to each other rather than maintained separately.
    const wf = read(path.join(ROOT, '.github', 'workflows', 'e2e-local.yml'));
    // Stop at a quote: the workflow writes it as `echo "SUPABASE_ADMIN_URL=..."`, and
    // `\S+` swallows the closing quote, producing an unparseable URL.
    const m = wf.match(/SUPABASE_ADMIN_URL=([^"'\s]+)/);
    assert.ok(
      m,
      'e2e-local.yml no longer sets SUPABASE_ADMIN_URL for the seeding step'
    );
    const host = new URL(m[1]).hostname;
    const { hosts } = loadRules();
    assert.ok(
      hosts.includes(host),
      `CI seeds against "${host}", which the guard does not classify as local — the ` +
        'required lane would fail at the seeding step'
    );
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
