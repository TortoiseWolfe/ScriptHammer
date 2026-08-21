/**
 * Every documented `rebrand.sh` command must actually run (#898 follow-up).
 *
 * WHY THIS EXISTS. PR #900 made the icon decision mandatory — `rebrand.sh` now
 * exits non-zero without `--icon` or `--no-icon`. The prose explaining that was
 * added in the same PR. The COMMANDS were not: seventeen documented invocations
 * were left showing a form that now fails, including `README.md`'s primary
 * "Fork it" block and the script's own `--help` examples.
 *
 * So for roughly an hour, the first command a new forker ran, copied verbatim
 * from the README, exited 1. Nothing caught it: the rebrand harness tests the
 * script's behaviour, and no test reads the documentation that tells people how
 * to invoke it.
 *
 * That is the shape this repo keeps paying for — a control whose subject moved.
 * This asserts the docs and the script agree about the required flags, so the
 * next contract change cannot quietly orphan the instructions.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/** Files that teach someone how to invoke the script. */
const DOC_SOURCES = [
  'README.md',
  'docs/FORKING.md',
  'docs/FORK-CHECKLIST.md',
  'docs/TEMPLATE-GUIDE.md',
  'scripts/rebrand.sh',
];

/**
 * A line that invokes the script with a positional argument — i.e. a command
 * someone could copy. Prose mentions ("the `scripts/rebrand.sh` script rewrites
 * …") and the `--help` synopsis are not invocations and are excluded by
 * requiring a character that starts an argument rather than a word boundary.
 *
 * The `scripts/` prefix is load-bearing: without it this also matched comments
 * mentioning `tests/rebrand/test-rebrand.sh`, which is the HARNESS, not the
 * script, and takes no such flags.
 */
const INVOCATION = /scripts\/rebrand\.sh\s+["'<$A-Za-z]/;

/** The synopsis line names the decision without being a runnable example. */
const IS_SYNOPSIS = (line) => /Usage:/.test(line);

function invocationsIn(file) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readFileSync(abs, 'utf8')
    .split('\n')
    .map((line, i) => ({ file, n: i + 1, line }))
    .filter(({ line }) => INVOCATION.test(line) && !IS_SYNOPSIS(line));
}

describe('documented rebrand.sh commands are runnable', () => {
  test('the premise holds: the script really does require the decision', () => {
    const script = fs.readFileSync(
      path.join(ROOT, 'scripts', 'rebrand.sh'),
      'utf8'
    );
    assert.match(
      script,
      /Refusing to rebrand without deciding about the app icons/,
      'rebrand.sh no longer refuses without an icon decision. If that requirement ' +
        'was deliberately removed, delete this test with it — do not leave it ' +
        'asserting a contract that no longer exists.'
    );
  });

  test('every documented invocation passes --icon or --no-icon', () => {
    const all = DOC_SOURCES.flatMap(invocationsIn);

    // Non-vacuity: if the regex stops matching, this test would pass while
    // reading nothing at all — the exact failure it exists to prevent.
    assert.ok(
      all.length >= 10,
      `Only found ${all.length} documented invocations across ${DOC_SOURCES.length} ` +
        `files. The matcher has probably stopped matching, so this test is ` +
        `asserting nothing. Fix the regex rather than the threshold.`
    );

    const stale = all.filter(
      ({ line }) => !/--icon\b/.test(line) && !/--no-icon\b/.test(line)
    );

    assert.deepEqual(
      stale.map(({ file, n, line }) => `${file}:${n}: ${line.trim()}`),
      [],
      'These documented commands exit non-zero as written: rebrand.sh requires ' +
        '--icon or --no-icon. Someone following them fails on their first command.'
    );
  });
});
