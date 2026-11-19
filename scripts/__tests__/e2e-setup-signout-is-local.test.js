/**
 * The E2E global setup must sign out with LOCAL scope only (#1402).
 *
 * supabase-js's `auth.signOut()` defaults to scope 'global', which deletes every
 * session the user holds. `global-setup.ts` signs in as the shared PRIMARY test
 * user to check its password, and every shard runs that setup against the same
 * hosted project. A shard that started later therefore logged out the shards
 * already running: the browser still held a token that looked valid, then the
 * server answered 403 on /auth/v1/user and 401 "Auth session missing!" on
 * create-order. Ten payment and messaging tests were hit that way (nine failed
 * in the last red hosted run) on the hosted runs from 6 Nov. Nothing in a single shard can see it, which is why it gets a guard.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const SETUP = path.join(
  __dirname,
  '..',
  '..',
  'tests',
  'e2e',
  'global-setup.ts'
);

/** Comments stripped, so prose explaining the old bug cannot satisfy a check. */
const code = fs
  .readFileSync(SETUP, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('E2E global setup signs out locally (#1402)', () => {
  it('finds the setup file where this guard points', () => {
    assert.ok(fs.existsSync(SETUP), 'tests/e2e/global-setup.ts is missing');
    assert.ok(code.includes('signInWithPassword'), 'credential check moved?');
  });

  it("every signOut() call passes the literal scope 'local'", () => {
    // Count ALL calls, then count the ones written exactly right. A bare
    // signOut(), signOut({}), signOut(options) or { scope: someVariable } all
    // default to or can become 'global', and none of them matches the second
    // pattern, so the two counts differ and this fails.
    const calls = code.match(/\.signOut\(/g) || [];
    const local =
      code.match(/\.signOut\(\s*\{\s*scope:\s*(['"])local\1\s*,?\s*\}\s*\)/g) ||
      [];
    assert.ok(calls.length > 0, 'the credential check no longer signs out?');
    assert.strictEqual(
      local.length,
      calls.length,
      "signOut() without the literal { scope: 'local' } defaults to 'global' and revokes the primary user's sessions in every other shard"
    );
  });

  it("no other E2E file calls signOut() without the literal scope 'local'", () => {
    // The helpers and specs sign out through the app menu, which ends one
    // session. A direct supabase-js call anywhere under tests/e2e must follow
    // the same rule as the setup file.
    const root = path.join(__dirname, '..', '..', 'tests', 'e2e');
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(root);
    assert.ok(files.length > 10, 'tests/e2e moved? found too few files');

    const offenders = [];
    for (const file of files) {
      const src = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      const calls = src.match(/\.signOut\(/g) || [];
      const local =
        src.match(
          /\.signOut\(\s*\{\s*scope:\s*(['"])local\1\s*,?\s*\}\s*\)/g
        ) || [];
      if (calls.length !== local.length)
        offenders.push(path.relative(root, file));
    }
    assert.deepStrictEqual(offenders, []);
  });
});
