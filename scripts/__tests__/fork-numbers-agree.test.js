/**
 * Every published fork-time number must come from one measurement (#960).
 *
 * THE FAILURE THIS ENDS. Four documents and a talk deck each quoted the rebrand's
 * size and duration, and they drifted apart: the docs said "645 files in 14
 * seconds" while the deck said 926 in 16s, and 645 was never a file count at all
 * — it came from a counter that double-counted every file matched by two sweeps
 * (#956). Two published sources of truth disagreeing about the same script is
 * worse than either being stale alone, and `docs/POSITIONING.md` is the first
 * thing a prospective forker reads.
 *
 * WHY A TEST RATHER THAN CARE. Because the previous fix was care: #927 corrected
 * the deck and left the four docs, and #954 corrected the deck again. A number
 * repeated in five places without a check is a number that will disagree with
 * itself again after the next measurement.
 *
 * This does NOT assert a particular value — re-measuring is expected and healthy.
 * It asserts they all quote the SAME value, so a re-measurement has to update
 * them together or fail loudly.
 */
const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** Where each source states the file count, and how it spells it. */
const FILE_COUNT_SOURCES = [
  ['README.md', /rewrites \*\*(\d[\d,]*) files\*\*/],
  ['docs/POSITIONING.md', /rebrands (\d[\d,]*) files in/],
  ['docs/FORKING.md', /rewrites (\d[\d,]*) files/],
  ['docs/FORKING.md', /automates updating (\d[\d,]*) files/],
  ['docs/FORK-CHECKLIST.md', /ships with (\d[\d,]*) files that reference/],
  ['docs/talks/why-build-one-app.html', /to rebrand (\d[\d,]*) files/],
];

/** …and the duration. */
const DURATION_SOURCES = [
  ['README.md', /script itself takes \*\*(\d+) seconds\*\*/],
  ['docs/POSITIONING.md', /files in (\d+) seconds/],
  ['docs/FORKING.md', /`rebrand\.sh` is (\d+) seconds/],
  ['docs/FORK-CHECKLIST.md', /of which (\d+)s is the script/],
  ['docs/talks/why-build-one-app.html', /<span class="n">(\d+)s<\/span>/],
];

function collect(sources, label) {
  const found = sources.map(([file, re]) => {
    const m = read(file).match(re);
    assert.ok(
      m,
      `${file} no longer states the ${label} in the expected form (${re}). ` +
        `If the wording changed, update this test — do not delete the assertion.`
    );
    return { file, value: m[1].replace(/,/g, '') };
  });
  // A floor: all-agreeing on nothing is not agreement.
  assert.ok(found.length >= 5, `only ${found.length} sources checked`);
  return found;
}

test('every source quotes the same rebrand file count', () => {
  const found = collect(FILE_COUNT_SOURCES, 'file count');
  const values = [...new Set(found.map((f) => f.value))];
  assert.strictEqual(
    values.length,
    1,
    `sources disagree:\n${found.map((f) => `  ${f.file}: ${f.value}`).join('\n')}`
  );
  assert.ok(Number(values[0]) > 100, `implausible file count: ${values[0]}`);
});

test('every source quotes the same rebrand duration', () => {
  const found = collect(DURATION_SOURCES, 'duration');
  const values = [...new Set(found.map((f) => f.value))];
  assert.strictEqual(
    values.length,
    1,
    `sources disagree:\n${found.map((f) => `  ${f.file}: ${f.value}`).join('\n')}`
  );
});

test('no source still quotes the retracted figures', () => {
  // 645 came from the double-counting summary; "200+ files" predates any
  // measurement and is off by ~4.6x. Neither should reappear.
  for (const [file] of [...FILE_COUNT_SOURCES, ['scripts/rebrand.sh']]) {
    const body = read(file);
    assert.doesNotMatch(
      body,
      /\b645 files\b/,
      `${file} quotes the retracted 645`
    );
    assert.doesNotMatch(
      body,
      /200\+ files/,
      `${file} quotes the pre-measurement "200+ files"`
    );
  }
});
