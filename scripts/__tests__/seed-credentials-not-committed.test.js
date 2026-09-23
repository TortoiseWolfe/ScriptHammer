const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

/**
 * No seeded credential may live in a tracked file, and no seeder may print one (#1246).
 *
 * The admin account carries is_admin. Its password sat in this public repo as a
 * literal for as long as the seeder existed, under a comment claiming no login
 * needed it — while a contract test signed in with it. These match SYNTAX, not
 * prose: a comment mentioning the old literal does not trip them; a code line does.
 */
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// A logged salt VALUE: `salt` reached as an identifier inside console.log — bare,
// dotted, or inside a template interpolation. The word inside a quoted message
// ('Salt generated') is not a value and must not trip this.
const LOGS_SALT_VALUE =
  /console\.log\((?:[^'\"`)]*|[^)]*\$\{[^}'\"`]*)\bsalt\b/i;

test('the admin seeder has no password literal and reads SEED_ADMIN_PASSWORD', () => {
  const src = stripComments(read('scripts/seed-test-users.ts'));
  assert.doesNotMatch(src, /password:\s*'[^']*'/, 'a quoted password literal');
  assert.match(src, /process\.env\.SEED_ADMIN_PASSWORD/);
  assert.match(src, /randomBytes\(/, 'a random fallback, not a fixed one');
});

test('the seeder prints emails, never passwords', () => {
  const src = stripComments(read('scripts/seed-test-users.ts'));
  assert.doesNotMatch(
    src,
    /console\.log\([^)]*\.password/,
    'a console.log interpolating .password'
  );
});

test('the admin contract test has no fallback password', () => {
  const src = stripComments(
    read('tests/contract/admin/admin-access.contract.test.ts')
  );
  assert.doesNotMatch(src, /SEED_ADMIN_PASSWORD\s*\|\|/, 'an || fallback');
  assert.doesNotMatch(src, /password:\s*'[^']*'/);
  assert.match(
    src,
    /ADMIN_PASSWORD \? describe : describe\.skip/,
    'skips by name'
  );
});

test('the key initialiser does not log any part of a salt', () => {
  const src = stripComments(read('scripts/initialize-test-keys.ts'));
  assert.doesNotMatch(src, LOGS_SALT_VALUE, 'a console.log of a salt value');
});

test('CONTROL: the salt matcher catches a logged value and ignores the word', () => {
  assert.match(
    'console.log(`Salt: ${keyPair.salt.substring(0, 20)}`)',
    LOGS_SALT_VALUE
  );
  assert.match('console.log(keyPair.salt)', LOGS_SALT_VALUE);
  assert.match('console.log(salt)', LOGS_SALT_VALUE);
  assert.doesNotMatch("console.log('Salt generated')", LOGS_SALT_VALUE);
  // A status message inside an interpolation is a word, not a value.
  assert.doesNotMatch(
    "console.log(`${u}: ${ok ? 'Has valid salt' : 'Missing salt'}`)",
    LOGS_SALT_VALUE
  );
});

test('CONTROL: the comment stripper leaves code alone', () => {
  assert.match(
    stripComments("const x = 1; // note\n/* c */ const y = 'p';"),
    /const y = 'p'/
  );
});
