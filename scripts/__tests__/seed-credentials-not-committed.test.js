const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
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
  // #1379: the variable is REQUIRED, not optional. A skip here ran nowhere, silently.
  assert.doesNotMatch(src, /describe\.skip|\.skipIf\(|it\.skip/, 'a skip');
  assert.match(
    src,
    /if \(!ADMIN_PASSWORD\) \{\s*throw new Error\(/,
    'throws when SEED_ADMIN_PASSWORD is absent'
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

/**
 * The three seeded TEST_USER_*_PASSWORD values used to be one public literal: in the tracked
 * env files, as the `||` fallback in about twenty specs and scripts, in the migration's seed
 * and in CLAUDE.md. That made the account's password known to anyone who read the repository.
 * None of these checks prints a value: they match the SHAPE of a fallback or an assignment.
 */
// A password variable read with a quoted string as its fallback: `|| 'x'`, `?? "x"`, `|| `x``.
const LITERAL_FALLBACK =
  /(?:process\.env\.|\$\{?)TEST_USER_[A-Z_]*PASSWORD\}?\s*(?:\|\||\?\?)\s*['"`]/;
// `NAME=value` (live or commented out) where the value is not blank, for the env-file checks.
const NONBLANK_ASSIGNMENT =
  /^\s*#?\s*(?:export\s+)?TEST_USER_[A-Z_]*PASSWORD=\s*[^\s#]/m;
// A bcrypt hash made from a quoted literal: crypt('...', gen_salt(...)).
const CRYPT_LITERAL = /crypt\(\s*'[^']*'\s*,\s*gen_salt/;

const trackedSources = () =>
  execFileSync('git', ['ls-files', 'tests', 'scripts', 'src'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => /\.(?:ts|tsx|js|mjs|cjs)$/.test(f))
    // This file spells the patterns out, so it is not a place a fallback can live.
    .filter((f) => !f.endsWith('seed-credentials-not-committed.test.js'));

test('no test or script reads a test-user password with a quoted fallback', () => {
  const offenders = trackedSources().filter((f) =>
    LITERAL_FALLBACK.test(stripComments(read(f)))
  );
  assert.deepEqual(offenders, [], 'files with a literal password fallback');
});

test('.env.local-supabase assigns no test-user password', () => {
  assert.doesNotMatch(read('.env.local-supabase'), NONBLANK_ASSIGNMENT);
});

test('.env.example gives no test-user password, even in a commented example', () => {
  assert.doesNotMatch(read('.env.example'), NONBLANK_ASSIGNMENT);
});

test('the local E2E lane generates its test-user passwords instead of copying them', () => {
  const wf = readFileSync(
    path.join(ROOT, '.github', 'workflows', 'e2e-local.yml'),
    'utf8'
  );
  const steps = wf
    .split(/^\s*- name: /m)
    .filter((s) =>
      /TEST_USER_\)' \.env\.local-supabase >> "\$GITHUB_ENV"/.test(s)
    );
  assert.ok(steps.length >= 2, 'parser control: the build and run steps');
  for (const step of steps) {
    assert.match(step, /openssl rand/, 'a step with no generated password');
    assert.match(step, /TEST_USER_PRIMARY_PASSWORD/);
    assert.match(step, /TEST_USER_SECONDARY_PASSWORD/);
    assert.match(step, /TEST_USER_TERTIARY_PASSWORD/);
  }
});

test('the migration seeds the primary user without a password literal', () => {
  const sql = read(
    'supabase/migrations/20251006_complete_monolithic_setup.sql'
  );
  assert.doesNotMatch(sql, CRYPT_LITERAL, 'a crypt() of a quoted literal');
  assert.match(sql, /current_setting\('app\.test_user_password', true\)/);
  assert.match(sql, /crypt\(seed_password, gen_salt\('bf'\)\)/);
  assert.doesNotMatch(read('supabase/seed-test-user.sql'), CRYPT_LITERAL);
});

test('CONTROL: the fallback, assignment and crypt matchers catch what they should', () => {
  assert.match(
    "x = process.env.TEST_USER_PRIMARY_PASSWORD || 'abc'",
    LITERAL_FALLBACK
  );
  assert.match(
    'x = process.env.TEST_USER_TERTIARY_PASSWORD ?? "abc"',
    LITERAL_FALLBACK
  );
  assert.doesNotMatch(
    "x = requireEnv('TEST_USER_PRIMARY_PASSWORD')",
    LITERAL_FALLBACK
  );
  assert.doesNotMatch(
    'x = process.env.TEST_USER_PRIMARY_PASSWORD || DEFAULT',
    LITERAL_FALLBACK
  );
  assert.match('TEST_USER_PRIMARY_PASSWORD=abc', NONBLANK_ASSIGNMENT);
  assert.match('export TEST_USER_SECONDARY_PASSWORD=abc', NONBLANK_ASSIGNMENT);
  assert.doesNotMatch('TEST_USER_PRIMARY_PASSWORD=\n', NONBLANK_ASSIGNMENT);
  assert.match('# TEST_USER_PRIMARY_PASSWORD=abc', NONBLANK_ASSIGNMENT);
  assert.doesNotMatch(
    '# TEST_USER_PRIMARY_PASSWORD=   # a hint',
    NONBLANK_ASSIGNMENT
  );
  assert.match("crypt('abc', gen_salt('bf'))", CRYPT_LITERAL);
  assert.doesNotMatch("crypt(seed_password, gen_salt('bf'))", CRYPT_LITERAL);
});
