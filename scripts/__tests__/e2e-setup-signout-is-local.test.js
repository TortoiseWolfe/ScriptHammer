/**
 * The E2E global setup must sign out with LOCAL scope only (#1402).
 *
 * supabase-js's `auth.signOut()` defaults to scope 'global', which deletes every
 * session the user holds. `global-setup.ts` signs in as the shared PRIMARY test
 * user to check its password, and every shard runs that setup against the same
 * hosted project. A shard that started later therefore logged out the shards
 * already running: the browser still held a token that looked valid, then the
 * server answered 403 on /auth/v1/user and 401 "Auth session missing!" on
 * create-order. Ten payment and messaging tests failed that way on every hosted
 * run from 6 Nov. Nothing in a single shard can see it, which is why it gets a guard.
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

  it('never calls signOut() without a scope', () => {
    const bare = code.match(/\.signOut\(\s*\)/g) || [];
    assert.strictEqual(
      bare.length,
      0,
      "signOut() defaults to scope 'global' and revokes the primary user's sessions in every other shard"
    );
  });

  it("never signs out with the 'global' or 'others' scope", () => {
    assert.doesNotMatch(code, /scope:\s*['"](global|others)['"]/);
  });

  it("signs out with scope 'local' after the credential check", () => {
    assert.match(code, /\.signOut\(\s*\{\s*scope:\s*'local'\s*\}\s*\)/);
  });
});
