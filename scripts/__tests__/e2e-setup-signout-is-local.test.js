/**
 * The E2E global setup must sign out with LOCAL scope only (#1402).
 *
 * supabase-js's `auth.signOut()` defaults to scope 'global', which deletes every
 * session the user holds. `global-setup.ts` signs in as the shared PRIMARY test
 * user to check its password, and every shard runs that setup against the same
 * hosted project. A shard that started later therefore logged out the shards
 * already running: the browser still held a token that looked valid, then the
 * server answered 403 on /auth/v1/user and 401 "Auth session missing!" on
 * create-order. Nine payment and messaging tests failed that way in the last
 * red hosted run (44349738952). Nothing in a single shard can see it, which is
 * why it gets a guard.
 *
 * The guard is strict on purpose: every `.signOut(...)` call must pass the
 * literal `{ scope: 'local' }`. A bare `signOut()`, `signOut({})`, a scope held
 * in a variable, or any other scope all fail, because none of them can be
 * checked by reading the file.
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
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const LOCAL_SCOPE_ARGUMENT = /^\{\s*scope:\s*(['"])local\1\s*,?\s*\}$/;

/**
 * Every `.signOut(` call in `code` with its argument text (up to the first
 * closing parenthesis) and whether that argument is exactly the local scope.
 */
function findSignOutCalls(code) {
  const calls = [];
  const call = /\.signOut\(([^)]*)\)/g;
  let match;
  while ((match = call.exec(code)) !== null) {
    const argument = match[1].trim();
    calls.push({ argument, isLocal: LOCAL_SCOPE_ARGUMENT.test(argument) });
  }
  return calls;
}

const code = stripComments(fs.readFileSync(SETUP, 'utf8'));

describe('E2E global setup signs out locally (#1402)', () => {
  it('finds the setup file where this guard points', () => {
    assert.ok(fs.existsSync(SETUP), 'tests/e2e/global-setup.ts is missing');
    assert.ok(code.includes('signInWithPassword'), 'credential check moved?');
  });

  it("signs out after the credential check, with the literal scope 'local' every time", () => {
    const calls = findSignOutCalls(code);
    assert.ok(
      calls.length > 0,
      'no .signOut( call found: the credential check leaves its session open'
    );
    const bad = calls.filter((c) => !c.isLocal).map((c) => c.argument || '()');
    assert.deepStrictEqual(
      bad,
      [],
      "signOut() defaults to scope 'global' and revokes the primary user's sessions in every other shard; every call must pass { scope: 'local' } as a literal"
    );
  });

  describe('the check itself can fail', () => {
    const accepted = [
      "await client.auth.signOut({ scope: 'local' });",
      'await client.auth.signOut({scope:"local"});',
      "await client.auth.signOut({\n  scope: 'local',\n});",
    ];
    const rejected = [
      ['no argument', 'await client.auth.signOut();'],
      ['empty options', 'await client.auth.signOut({});'],
      ['options in a variable', 'await client.auth.signOut(opts);'],
      ['scope in a variable', 'await client.auth.signOut({ scope: scope });'],
      ['global scope', "await client.auth.signOut({ scope: 'global' });"],
      ['others scope', "await client.auth.signOut({ scope: 'others' });"],
      [
        'one good call hiding a bad one',
        "await a.auth.signOut({ scope: 'local' });\nawait b.auth.signOut();",
      ],
    ];

    for (const source of accepted) {
      it(`accepts ${JSON.stringify(source)}`, () => {
        const calls = findSignOutCalls(source);
        assert.strictEqual(calls.length, 1);
        assert.ok(calls[0].isLocal);
      });
    }

    for (const [name, source] of rejected) {
      it(`rejects ${name}`, () => {
        const calls = findSignOutCalls(source);
        assert.ok(calls.length > 0, 'the call was not found at all');
        assert.ok(
          calls.some((c) => !c.isLocal),
          'a call that is not the literal local scope slipped through'
        );
      });
    }

    it('ignores a signOut that only appears in a comment', () => {
      const stripped = stripComments(
        "// client.auth.signOut();\n/* client.auth.signOut(); */\nclient.auth.signOut({ scope: 'local' });"
      );
      assert.deepStrictEqual(
        findSignOutCalls(stripped).map((c) => c.isLocal),
        [true]
      );
    });
  });
});
