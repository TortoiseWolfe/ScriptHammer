'use strict';
/**
 * `pnpm run use:local` fills the seeded test users' passwords in the gitignored .env with random
 * values, because no tracked file may hold one (#1246). It runs the real script against a
 * throwaway copy of the repo layout, so nothing in the working tree is touched, and prints
 * names and counts only, never a value.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REAL = path.resolve(__dirname, '..', '..');
const KEYS = [
  'TEST_USER_PRIMARY_PASSWORD',
  'TEST_USER_SECONDARY_PASSWORD',
  'TEST_USER_TERTIARY_PASSWORD',
];

function valueOf(envText, key) {
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(envText);
  return m ? m[1] : null;
}

describe('use:local generates test-user passwords', () => {
  let dir;
  const run = () =>
    execFileSync(
      'node',
      [path.join(dir, 'scripts', 'switch-env.js'), 'local'],
      {
        encoding: 'utf8',
      }
    );

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-env-'));
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.copyFileSync(
      path.join(REAL, 'scripts', 'switch-env.js'),
      path.join(dir, 'scripts', 'switch-env.js')
    );
    fs.copyFileSync(
      path.join(REAL, '.env.local-supabase'),
      path.join(dir, '.env.local-supabase')
    );
    fs.writeFileSync(
      path.join(dir, '.env'),
      'NEXT_PUBLIC_SUPABASE_URL=https://x.example\n'
    );
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('writes a distinct, non-blank value for each of the three', () => {
    const out = run();
    const env = fs.readFileSync(path.join(dir, '.env'), 'utf8');
    const values = KEYS.map((k) => valueOf(env, k));
    for (const [i, v] of values.entries()) {
      assert.ok(v && v.length >= 24, `${KEYS[i]} is blank or short`);
    }
    assert.equal(new Set(values).size, 3, 'the three values must differ');
    for (const v of values) {
      assert.ok(!out.includes(v), 'a generated value was printed');
    }
  });

  it('leaves a value that is already there alone on the next switch', () => {
    const before = fs.readFileSync(path.join(dir, '.env'), 'utf8');
    run();
    const after = fs.readFileSync(path.join(dir, '.env'), 'utf8');
    for (const k of KEYS) {
      assert.equal(valueOf(after, k), valueOf(before, k), `${k} changed`);
    }
  });

  it('CONTROL: a blank value is filled in, not kept', () => {
    const env = fs
      .readFileSync(path.join(dir, '.env'), 'utf8')
      .replace(
        /^TEST_USER_PRIMARY_PASSWORD=.*$/m,
        'TEST_USER_PRIMARY_PASSWORD='
      );
    fs.writeFileSync(path.join(dir, '.env'), env);
    run();
    const v = valueOf(fs.readFileSync(path.join(dir, '.env'), 'utf8'), KEYS[0]);
    assert.ok(v && v.length >= 24, 'a blank password was not filled');
  });
});
