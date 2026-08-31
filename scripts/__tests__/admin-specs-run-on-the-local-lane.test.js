/**
 * The three admin E2E specs must skip on the BACKEND, not on `CI` (#914).
 *
 * They carried `test.skip(!!process.env.CI, 'requires local Docker Supabase')`,
 * which outlived its premise. When it was written "CI" meant the shared hosted
 * project. It now also means `e2e-local.yml`, which brings up a Supabase per shard
 * and sets `CI: 'true'` — so the specs skipped on the one lane that satisfies the
 * requirement their own message names, and did so silently for months.
 *
 * A skip is invisible by construction: a skipped spec is a green spec. Nothing else
 * in the suite can notice this regressing, which is why it gets a guard.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const SPECS = [
  'admin-dashboard.spec.ts',
  'admin-conversation-list.spec.ts',
  'admin-user-pagination.spec.ts',
].map((f) => path.join(__dirname, '..', '..', 'tests', 'e2e', 'admin', f));

/** Comments stripped, so the prose explaining the old skip cannot satisfy a check. */
const codeOf = (p) =>
  fs
    .readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('admin specs run on the local lane (#914)', () => {
  it('finds all three specs where this guard points', () => {
    // Without this the file passes vacuously if a spec is renamed or moved.
    for (const p of SPECS) {
      assert.ok(fs.existsSync(p), `${path.basename(p)} is missing`);
    }
    assert.strictEqual(SPECS.length, 3);
  });

  for (const p of SPECS) {
    const name = path.basename(p);

    it(`${name} does NOT skip on process.env.CI`, () => {
      assert.doesNotMatch(
        codeOf(p),
        /test\.skip\(\s*!!\s*process\.env\.CI/,
        `${name} skips on CI again. The local lane IS CI and provides exactly the ` +
          'disposable Supabase the skip claims to need, so this hides the spec on ' +
          'the only lane that can run it.'
      );
    });

    it(`${name} skips on the absence of a local backend instead`, () => {
      assert.match(
        codeOf(p),
        /test\.skip\(\s*!isLocalSupabaseUrl\(\s*resolveBackendUrl\(\)\s*\)/,
        `${name} no longer keys its skip on the backend being local and disposable`
      );
    });

    it(`${name} still asserts the backend before it writes`, () => {
      // The belt-and-braces. The skip decides whether to run; this throws if a
      // non-local backend somehow reaches the seeding (#944, and #877 before it).
      assert.match(codeOf(p), /assertLocalBackend\(/, `${name} lost its guard`);
    });
  }

  it('the matchers can actually fail', () => {
    const CI_SKIP = /test\.skip\(\s*!!\s*process\.env\.CI/;
    const BACKEND_SKIP =
      /test\.skip\(\s*!isLocalSupabaseUrl\(\s*resolveBackendUrl\(\)\s*\)/;
    assert.match('test.skip(!!process.env.CI, "x")', CI_SKIP);
    assert.doesNotMatch(
      'test.skip(!isLocalSupabaseUrl(resolveBackendUrl()))',
      CI_SKIP
    );
    assert.match(
      'test.skip(!isLocalSupabaseUrl(resolveBackendUrl()), "x")',
      BACKEND_SKIP
    );
    assert.doesNotMatch('', BACKEND_SKIP);
  });
});

describe('the local lane applies the admin demo seed (#914)', () => {
  const WORKFLOW = path.join(
    __dirname,
    '..',
    '..',
    '.github',
    'workflows',
    'e2e-local.yml'
  );

  /**
   * YAML comments stripped, for the same reason the spec matcher above strips JS
   * comments — and this one was caught by mutation rather than by review: the
   * step's own comment explains WHY ON_ERROR_STOP is there, so deleting the flag
   * while leaving the comment left this assertion green.
   *
   * Only whole-line comments are removed; a `#` inside a quoted string is left
   * alone, which is enough here and avoids pretending to be a YAML parser.
   */
  const workflowCode = () =>
    fs
      .readFileSync(WORKFLOW, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it('applies seed-admin-demo.sql', () => {
    // It was fixed under #940 and then wired nowhere — a repo-wide grep found it
    // only in comments, including in the headers of the specs that require it.
    assert.match(
      workflowCode(),
      /seed-admin-demo\.sql/,
      'the local lane no longer applies the admin demo seed'
    );
  });

  it('stops on a failed statement rather than reporting success', () => {
    assert.match(
      workflowCode(),
      /ON_ERROR_STOP=1/,
      'psql without ON_ERROR_STOP reports success after a failed statement, and ' +
        'hands the specs a half-seeded database'
    );
  });

  it('asserts the seeded population, since the seed is idempotent', () => {
    // ON CONFLICT DO NOTHING makes a no-op run and a real run look identical, so
    // the count is the only evidence the rows arrived.
    assert.match(
      workflowCode(),
      /is_admin = FALSE/,
      'nothing checks that the seed produced the non-admin population ' +
        'admin-user-pagination needs'
    );
  });
});
