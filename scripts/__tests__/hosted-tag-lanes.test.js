/**
 * The `@hosted` lane split (#725) is a CONTRACT SPREAD ACROSS THREE FILES, and nothing
 * else notices when one of them moves.
 *
 *   1. `tests/e2e/security/oauth-csrf.spec.ts` — six tests carry `{ tag: '@hosted' }`
 *      because they wait for a redirect to a real OAuth provider.
 *   2. `.github/workflows/e2e-local.yml` — passes `--grep-invert='@hosted'`, so the
 *      local-Supabase lane skips them instead of failing 18 times.
 *   3. `.github/workflows/e2e.yml` — deliberately UNFILTERED, so they still run somewhere.
 *
 * Every way this drifts is silent, and each fails in a different direction:
 *
 *   - drop the flag from e2e-local.yml  -> the local lane goes red on 18 tests that
 *     cannot pass there, and the natural "fix" is to delete them
 *   - drop a tag from a test            -> that test starts failing locally, forever
 *   - tag the seventh test              -> the ONLY local check that the OAuth buttons
 *     still render is silently gone, and nothing goes red to say so
 *   - add `--grep` to e2e.yml's shards  -> Playwright suppresses "No tests found" when
 *     `--shard` is passed, so 21+ of its 24 jobs become empty green ticks (#396 shape)
 *
 * The last one is why e2e.yml is asserted to have NO grep at all: that workflow has no
 * per-shard tripwire, so an empty shard there is indistinguishable from a passing one.
 *
 * Modelled on `e2e-paths-ignore.test.js`, including its two disciplines: assert the
 * parser actually found something before asserting anything about the contents, and
 * include a control proving the comparator can fail.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SPEC = path.join(
  REPO_ROOT,
  'tests',
  'e2e',
  'security',
  'oauth-csrf.spec.ts'
);
const LOCAL_WF = path.join(REPO_ROOT, '.github', 'workflows', 'e2e-local.yml');
const HOSTED_WF = path.join(REPO_ROOT, '.github', 'workflows', 'e2e.yml');

const TAG = '@hosted';

/** The six that need a live provider. Pinned by title so adding or removing one is a
 *  deliberate act with a diff, not a silent drift. */
const HOSTED_TITLES = [
  'OAuth redirect should include state parameter for CSRF protection',
  'OAuth state parameter should be unique per request',
  'OAuth redirect should go to correct provider',
  'OAuth flow should include required OAuth parameters',
  'different browser sessions should have isolated OAuth state',
  'OAuth redirect_uri should point to Supabase callback',
];

/** Pure DOM, passes against a local stack, and the only local guard that the OAuth
 *  buttons still render. It must NEVER be tagged. */
const LOCAL_ONLY_TITLE =
  'OAuth buttons should be visible and enabled on sign-in page';

/**
 * Parse `test('title'[, { tag: '...' }], ...)` declarations out of a spec.
 * Returns [{ title, tag|null }]. Deliberately strict — callers assert on the count.
 */
function readTests(source) {
  const out = [];
  const re = /\btest\(\s*(['"])(.*?)\1\s*(,\s*\{([^}]*)\})?/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const opts = m[4] || '';
    const tagMatch = opts.match(/tag:\s*(['"])(.*?)\1/);
    out.push({ title: m[2], tag: tagMatch ? tagMatch[2] : null });
  }
  return out;
}

/**
 * Extract the tag tokens from a `--grep-invert=...` / `--grep=...` flag.
 *
 * TOKENS, NOT THE RAW STRING. Playwright applies `forceRegExp` to the flag value, so
 * `@hosted` also matches `@hosted-only` — comparing raw strings would call those equal
 * when they select different sets.
 */
/**
 * Strip `#` comments from YAML before matching.
 *
 * Without this the count includes the flag as it appears in PROSE. A comment added under
 * #575 explained that the lane excludes `@hosted` — and quoting the flag to explain it
 * pushed the count from 1 to 2, failing this guard with "found 2" while the workflow had
 * exactly one real occurrence. That is the repo's recurring "a guard matches its own
 * documentation" trap, arriving from the other side: here the prose was innocent and the
 * guard was too literal.
 *
 * Naive on purpose — a `#` inside a quoted YAML scalar would be stripped too. That is
 * acceptable for counting a command-line flag, and the alternative is a YAML parser for a
 * regex count.
 */
function stripYamlComments(yamlText) {
  return yamlText
    .split('\n')
    .map((line) => {
      const i = line.indexOf('#');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

function readGrepFlags(yamlText, flag) {
  const re = new RegExp(`--${flag}=(['"]?)([^'"\\s\\\\]+)\\1`, 'g');
  const found = [];
  let m;
  const src = stripYamlComments(yamlText);
  while ((m = re.exec(src)) !== null) {
    found.push(m[2].match(/@[\w-]+/g) || []);
  }
  return found;
}

describe('the @hosted lane split (#725)', () => {
  const specSrc = fs.readFileSync(SPEC, 'utf8');
  const tests = readTests(specSrc);

  it('the parser found the spec it is asserting about', () => {
    // Without this every assertion below could pass vacuously on an empty parse.
    assert.strictEqual(
      tests.length,
      HOSTED_TITLES.length + 1,
      `expected ${HOSTED_TITLES.length + 1} tests in oauth-csrf.spec.ts, parsed ` +
        `${tests.length} — the parser is stale, so nothing below means anything`
    );
  });

  it('exactly the six provider-dependent tests carry the tag', () => {
    const tagged = tests.filter((t) => t.tag === TAG).map((t) => t.title);
    assert.deepStrictEqual(
      tagged.sort(),
      [...HOSTED_TITLES].sort(),
      'the @hosted set has drifted. Adding one removes it from every PR; removing one ' +
        'makes the local lane fail forever on a test that cannot pass there.'
    );
  });

  it("the DOM-only test is NOT tagged — it is the local lane's last OAuth check", () => {
    const local = tests.find((t) => t.title === LOCAL_ONLY_TITLE);
    assert.ok(local, `"${LOCAL_ONLY_TITLE}" is gone — was it renamed?`);
    assert.strictEqual(
      local.tag,
      null,
      'the buttons-render test was tagged @hosted, so no PR checks that the OAuth ' +
        'buttons still appear. It touches no network and passes locally by design.'
    );
  });

  it('the local lane excludes exactly the tag, and nothing else', () => {
    const flags = readGrepFlags(
      fs.readFileSync(LOCAL_WF, 'utf8'),
      'grep-invert'
    );
    assert.strictEqual(
      flags.length,
      1,
      `expected exactly one --grep-invert in e2e-local.yml, found ${flags.length}. ` +
        'Zero means the lane is running tests that cannot pass against a local stack.'
    );
    assert.deepStrictEqual(
      flags[0],
      [TAG],
      `the local lane's exclusion is ${JSON.stringify(flags[0])}, not ["${TAG}"]`
    );
  });

  it('the hosted lane stays unfiltered — a filtered shard is a silent empty pass', () => {
    const hostedSrc = fs.readFileSync(HOSTED_WF, 'utf8');
    // Both spellings of the invocation count. The lane used to call `pnpm exec
    // playwright test` directly; since #829 it goes through the container runner as
    // `playwright-in-container.sh test`, which does NOT contain the old substring.
    // This anchor is the non-vacuity guard for the assertion below, so matching only
    // the retired spelling would have quietly turned that assertion decorative.
    assert.ok(
      /playwright(-in-container\.sh)?\s+test/.test(hostedSrc),
      'e2e.yml no longer invokes playwright — this guard is anchored to a stale shape'
    );
    const greps = readGrepFlags(hostedSrc, 'grep');
    assert.deepStrictEqual(
      greps,
      [],
      'e2e.yml gained a --grep. Its matrix passes --shard, and Playwright SUPPRESSES ' +
        '"No tests found" whenever --shard is set, so shards matching nothing exit 0 ' +
        'with an empty report. e2e.yml has no per-shard tripwire, so those are ' +
        'indistinguishable from passes. Add the tripwire first (Phase 4).'
    );
  });

  it('the control can fail — a drifted pair is rejected', () => {
    // Guards the guard. If these comparators stopped discriminating, every assertion
    // above would be decorative.
    const drifted = readTests(
      `test('${LOCAL_ONLY_TITLE}', { tag: '${TAG}' }, async () => {});`
    );
    assert.strictEqual(
      drifted[0].tag,
      TAG,
      'parser cannot see a tag it should see'
    );

    const nearMiss = readGrepFlags(
      "--grep-invert='@hosted-only' \\",
      'grep-invert'
    );
    assert.notDeepStrictEqual(
      nearMiss[0],
      [TAG],
      '@hosted-only must not compare equal to @hosted — Playwright regex-matches the ' +
        'flag, so the two select different sets'
    );
  });
});

/**
 * THE MIRROR IMAGE: `@local-only` (#1510).
 *
 * Thirty tests cannot run on the hosted lane and used to be reported there as "30 skipped":
 * 27 admin tests that seed and delete data (the hosted backend is the shared project, #944)
 * and 3 that submit a real sign-in form (the hosted project is CAPTCHA-protected, #353).
 * Jonathan chose to tag them and leave them out of the hosted run rather than keep a
 * baseline of 30 skips (18 Nov 2026). They still run, and are counted, on the required
 * local lane, which does not exclude this tag.
 *
 * What can drift, and how each way fails silently:
 *
 *   - tag a 31st test       -> it silently stops running against real production data
 *   - drop a tag            -> the hosted lane goes back to reporting skips, which the
 *                              verdict gate now fails
 *   - exclude the tag in e2e-local.yml -> the 30 run NOWHERE, every check stays green
 *   - drop the flag from one of the three hosted shard jobs -> that job's skips fail it
 */
describe('the @local-only lane split (#1510)', () => {
  const LOCAL_ONLY = '@local-only';

  // Specs where the tag sits on the top-level describe, so every test in the file carries it.
  const DESCRIBE_TAGGED = {
    'tests/e2e/admin/admin-dashboard.spec.ts': 20,
    'tests/e2e/admin/admin-user-pagination.spec.ts': 5,
    'tests/e2e/admin/admin-conversation-list.spec.ts': 2,
  };
  // Specs where individual tests carry the tag (the others in the file run on the hosted lane).
  const TEST_TAGGED = {
    'tests/e2e/auth/session-persistence.spec.ts': [
      'should extend session duration with Remember Me checked',
      'should use short session without Remember Me',
    ],
    'tests/e2e/debug/capture-decryption-logs.spec.ts': [
      'capture console output from message exchange',
    ],
  };
  const EXPECTED_TOTAL = 30;

  const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

  /** Every spec under tests/e2e that mentions the tag, so a stray one is found. */
  function filesMentioningTag() {
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (
          entry.name.endsWith('.ts') &&
          fs.readFileSync(full, 'utf8').includes(LOCAL_ONLY)
        )
          out.push(path.relative(REPO_ROOT, full));
      }
    };
    walk(path.join(REPO_ROOT, 'tests', 'e2e'));
    return out.sort();
  }

  it('the tag is on exactly the thirty tests, no more and no fewer', () => {
    let total = 0;

    for (const [rel, expected] of Object.entries(DESCRIBE_TAGGED)) {
      const src = read(rel);
      const found = readTests(src).length;
      assert.strictEqual(
        found,
        expected,
        `${rel} has ${found} tests, expected ${expected}. They are all tagged through the ` +
          'describe, so a new test here silently becomes local-only. Count it on purpose.'
      );
      const describes = [
        ...src.matchAll(
          /^test\.describe\((['"])[^'"]*\1,\s*\{\s*tag:\s*(['"])@local-only\2\s*\}/gm
        ),
      ];
      assert.strictEqual(
        describes.length,
        1,
        `${rel}: the top-level describe must carry { tag: '${LOCAL_ONLY}' }`
      );
      total += found;
    }

    for (const [rel, titles] of Object.entries(TEST_TAGGED)) {
      const tagged = readTests(read(rel))
        .filter((t) => t.tag === LOCAL_ONLY)
        .map((t) => t.title);
      assert.deepStrictEqual(tagged.sort(), [...titles].sort(), rel);
      total += tagged.length;
    }

    assert.strictEqual(
      total,
      EXPECTED_TOTAL,
      `${total} tests are tagged ${LOCAL_ONLY}, expected ${EXPECTED_TOTAL}. Each one is a ` +
        'test the hosted lane no longer runs against real production data.'
    );
  });

  it('no other spec carries the tag', () => {
    assert.deepStrictEqual(
      filesMentioningTag(),
      [...Object.keys(DESCRIBE_TAGGED), ...Object.keys(TEST_TAGGED)].sort()
    );
  });

  it('every hosted shard job excludes the tag, and the local lane does not', () => {
    const hosted = readGrepFlags(
      read('.github/workflows/e2e.yml'),
      'grep-invert'
    );
    // Three matrix jobs run `--shard`: the gen/msg-iso shards of each browser group.
    const shardJobs = (
      stripYamlComments(read('.github/workflows/e2e.yml')).match(/--shard=/g) ||
      []
    ).length;
    assert.strictEqual(shardJobs, 3, 'expected three --shard invocations');
    assert.deepStrictEqual(
      hosted,
      [[LOCAL_ONLY], [LOCAL_ONLY], [LOCAL_ONLY]],
      "each of the three hosted shard jobs needs --grep-invert='@local-only', or that " +
        'job reports the tagged tests as skipped and the verdict gate fails it'
    );
    const local = readGrepFlags(
      read('.github/workflows/e2e-local.yml'),
      'grep-invert'
    );
    for (const tokens of local)
      assert.ok(
        !tokens.includes(LOCAL_ONLY),
        'e2e-local.yml excludes @local-only, so the thirty tests run nowhere'
      );
  });

  it('the control can fail — a stray tag and a missing flag are both seen', () => {
    const stray = readTests(
      "test('x', { tag: '@local-only' }, async () => {});"
    );
    assert.strictEqual(stray[0].tag, LOCAL_ONLY);
    assert.deepStrictEqual(
      readGrepFlags("--grep-invert='@hosted' \\", 'grep-invert'),
      [['@hosted']],
      'a flag for another tag must not read as @local-only'
    );
  });
});
