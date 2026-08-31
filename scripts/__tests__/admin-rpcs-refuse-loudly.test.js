/**
 * An admin RPC must REFUSE, not answer with an empty result (#1029).
 *
 * All ten used to end their guard with:
 *
 *     IF NOT is_admin() THEN
 *       RETURN '{}'::json;
 *     END IF;
 *
 * — a successful response containing nothing. The clients cast it straight to the
 * success type, so "you are not an admin", "the shape drifted" and "there are no
 * rows" became one indistinguishable outcome. Four E2E tests failed on it for
 * months with nothing anywhere naming a cause (#914), and three CI rounds went
 * into finding it.
 *
 * The pattern is cheap to reintroduce — it is what every one of these functions
 * looked like, and it is the obvious thing to write when adding the eleventh.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const MIGRATION = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20251006_complete_monolithic_setup.sql'
);

/** SQL with `--` comments stripped, so prose about the old pattern cannot match. */
function sqlOnly() {
  return fs
    .readFileSync(MIGRATION, 'utf8')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** Every `IF NOT is_admin() THEN` guard, with the statement that follows it. */
function adminGuards() {
  const lines = sqlOnly().split('\n');
  const guards = [];
  lines.forEach((line, i) => {
    if (!/IF NOT is_admin\(\)\s+THEN/.test(line)) return;
    // Wide enough to reach past the rationale comment to the RAISE and its
    // ERRCODE. Stripping comments blanks the TEXT but keeps the lines, so the
    // window has to span them — a narrower one reported guards as missing an
    // ERRCODE that was two lines further down.
    const body = lines
      .slice(i + 1, i + 14)
      .join('\n')
      .trim();
    guards.push({ line: i + 1, body });
  });
  return guards;
}

describe('admin RPCs refuse loudly (#1029)', () => {
  it('finds the migration and a meaningful number of guards', () => {
    // Non-vacuity. If the guards move or the file is renamed, "none of them
    // return an empty object" is trivially true and this file measures nothing.
    assert.ok(fs.existsSync(MIGRATION), 'monolithic migration not found');
    const n = adminGuards().length;
    assert.ok(
      n >= 10,
      `expected at least 10 admin guards, found ${n} — did they move?`
    );
  });

  it('none of them answers a refusal with an empty result', () => {
    const offenders = adminGuards()
      .filter((g) => /RETURN\s+'\{\}'/.test(g.body))
      .map((g) => `migration:${g.line}`);
    assert.deepStrictEqual(
      offenders,
      [],
      'an admin RPC answers a refusal with an empty object again. That is a ' +
        'SUCCESSFUL response containing nothing, and it is indistinguishable ' +
        'from "no rows" everywhere above it. RAISE with ERRCODE 42501 instead.'
    );
  });

  it('every one of them raises', () => {
    const silent = adminGuards()
      .filter((g) => !/RAISE\s+EXCEPTION/.test(g.body))
      .map((g) => `migration:${g.line}`);
    assert.deepStrictEqual(silent, [], 'admin guard(s) that do not raise');
  });

  it('raises with insufficient_privilege, so PostgREST answers 403', () => {
    // Without an explicit ERRCODE, plpgsql raises P0001 and PostgREST maps it to
    // HTTP 400 — which reads as "you sent a bad request", not "you may not".
    const wrongCode = adminGuards()
      .filter((g) => !/ERRCODE\s*=\s*'42501'/.test(g.body))
      .map((g) => `migration:${g.line}`);
    assert.deepStrictEqual(
      wrongCode,
      [],
      'admin guard(s) raising without ERRCODE 42501'
    );
  });

  it('the matchers can actually fail', () => {
    // The control, including the comment-stripping that makes the checks honest.
    const strip = (sql) =>
      sql
        .split('\n')
        .map((l) => l.replace(/--.*$/, ''))
        .join('\n');
    assert.match(strip("RETURN '{}'::json;"), /RETURN\s+'\{\}'/);
    assert.doesNotMatch(
      strip("-- RETURN '{}'::json; (the old pattern)"),
      /RETURN\s+'\{\}'/
    );
    assert.match(
      strip("RAISE EXCEPTION 'x' USING ERRCODE = '42501';"),
      /ERRCODE\s*=\s*'42501'/
    );
    assert.doesNotMatch(strip(''), /RAISE\s+EXCEPTION/);
  });
});
