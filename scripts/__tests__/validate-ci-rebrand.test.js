/**
 * Nothing that execs into the app may hardcode the Compose service name (#957).
 *
 * scripts/rebrand.sh renames that service to the fork's slug, so a literal breaks
 * the first push from every rebranded fork with `no such service` — naming a
 * service the forker has never heard of, on a repository they just created.
 *
 * #910/#921 fixed the Git hooks and deliberately left the scripts, assessing them
 * as doc strings. `validate-ci.sh:54` was not a doc string: it was the executable
 * path of the gate the hooks invoke, so .husky/pre-push derived the right service
 * and then called a gate that ignored it.
 *
 * TWO WAYS A GUARD LIKE THIS PASSES WHILE THE BUG SURVIVES, both real here:
 *
 *   1. Matching raw source hits the file's own prose. Three of these scripts
 *      EXPLAIN the hardcode in a comment; a naive grep flags them and gets
 *      "fixed" by loosening until it flags nothing at all.
 *   2. `grep 'exec.*scripthammer'` finds four of the five sites in
 *      e2e-live-acceptance.sh. The fifth is `docker compose exec -T \` with the
 *      service on the NEXT line, so a line-oriented match walks past it.
 *
 * So: strip comments, join continuations, then match. And a mutation case proves
 * the matcher can still fail, because a guard that cannot is worth nothing.
 */
const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

const ROOT = join(__dirname, '..', '..');
const HELPER = join(ROOT, 'scripts', 'lib', 'compose-service.sh');

/** Every script that execs into the app service. */
const EXEC_SCRIPTS = [
  'scripts/validate-ci.sh',
  'scripts/test-suite.sh',
  'scripts/e2e-live-acceptance.sh',
];

/** Source with comments removed and line continuations joined. */
function executableSource(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
    .split('\n')
    .map((l) => l.replace(/(^|\s)#.*$/, '$1'))
    .join('\n')
    .replace(/\\\n\s*/g, ' ');
}

/** The literal is legitimate in exactly one place: the helper's own fallback. */
const FALLBACK = /COMPOSE_SERVICE=scripthammer/;

for (const rel of EXEC_SCRIPTS) {
  test(`${rel} execs a derived service, not a literal`, () => {
    const code = executableSource(rel);
    const offenders = code
      .split('\n')
      .filter((l) => /docker compose exec\b/.test(l))
      .filter((l) => /\bscripthammer\b/.test(l))
      .filter((l) => !FALLBACK.test(l));
    assert.deepStrictEqual(
      offenders,
      [],
      `hardcoded service name in an exec:\n${offenders.join('\n')}`
    );
  });

  test(`${rel} sources the shared derivation`, () => {
    const code = executableSource(rel);
    assert.match(
      code,
      /lib\/compose-service\.sh/,
      'must source scripts/lib/compose-service.sh rather than carry its own copy'
    );
    assert.match(code, /COMPOSE_SERVICE=\$\(compose_service\)/);
  });
}

test('.husky/pre-push derives it too, and passes it nothing it must re-derive', () => {
  const code = executableSource('.husky/pre-push');
  assert.match(code, /COMPOSE_SERVICE=\$\(compose_service\)/);
});

test('the derivation resolves to a service that exists in docker-compose.yml', () => {
  const service = execFileSync(
    'bash',
    ['-c', `. "${HELPER}"; compose_service`],
    { cwd: ROOT, encoding: 'utf8' }
  ).trim();
  assert.ok(service.length > 0, 'derivation produced nothing');
  const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8');
  assert.match(compose, new RegExp(`^\\s{2}${service}:`, 'm'));
});

test('the matcher still catches a reintroduced literal — including a continued one', () => {
  // The mutation this guard exists for. Both shapes must be caught; the second
  // is the one that slipped past the obvious grep.
  const inline = 'docker compose exec -T scripthammer pnpm test';
  const continued = 'docker compose exec -T \\\n  scripthammer pnpm test';
  const joined = continued.replace(/\\\n\s*/g, ' ');
  for (const [label, code] of [
    ['inline', inline],
    ['continued', joined],
  ]) {
    const hit = /docker compose exec\b.*\bscripthammer\b/.test(code);
    assert.ok(hit, `matcher missed the ${label} form`);
  }
});

test('a comment mentioning the old service name is NOT an offence', () => {
  // Loosening the matcher until it stops flagging prose is how this class of
  // guard dies. Three of these scripts legitimately explain the hardcode.
  const code = executableSource('scripts/test-suite.sh');
  assert.doesNotMatch(
    code,
    /# .*docker compose exec scripthammer/,
    'comments should have been stripped before matching'
  );
});
