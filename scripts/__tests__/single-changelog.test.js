/**
 * There is exactly ONE changelog a release updates (#569).
 *
 * THE FAILURE THIS ENDS. Two tracked files were named `CHANGELOG.md` — one at the
 * repo root, one at `docs/project/` — with different content and **contradictory
 * histories**: the root dated `0.1.0` to 2026-01-13, the canonical one to
 * 2025-09-14. Only `README.md` named a path. Every other reference, including the
 * release role's own pre-release checklist and the `/changelog-update` skill, said
 * "CHANGELOG.md" unqualified, so whichever file an agent opened first won.
 *
 * A release process that maintains the wrong changelog produces a changelog nobody
 * reads and release notes that omit real changes.
 *
 * WHY THE ROOT FILE WAS MOVED, NOT MERGED. It was not a stale copy. It was the
 * planning-factory / wireframe-pipeline changelog — SpecKit, tmux roles, RFCs,
 * validator rules — a different subsystem with its own history. Merging that into a
 * semver changelog would have produced one file describing two unrelated things,
 * with the interleaved dates making both harder to read. It is archived at
 * `docs/project/PLANNING-FACTORY-CHANGELOG.md` instead.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CANONICAL = path.join(ROOT, 'docs', 'project', 'CHANGELOG.md');
const ARCHIVE = path.join(
  ROOT,
  'docs',
  'project',
  'PLANNING-FACTORY-CHANGELOG.md'
);
const RELEASE_ROLE = path.join(ROOT, '.claude', 'roles', 'release.md');

test('no CHANGELOG.md at the repo root', () => {
  assert.ok(
    !fs.existsSync(path.join(ROOT, 'CHANGELOG.md')),
    'a CHANGELOG.md is back at the repo root. Two files with one name is how #569 ' +
      'happened: every unqualified "update CHANGELOG.md" instruction becomes a coin ' +
      'flip. The product changelog is docs/project/CHANGELOG.md.'
  );
});

test('the canonical changelog exists and has release history', () => {
  // The negative above passes trivially if someone deletes everything. This is the
  // positive control that makes it mean something.
  assert.ok(fs.existsSync(CANONICAL), 'docs/project/CHANGELOG.md is missing');

  const versions = fs
    .readFileSync(CANONICAL, 'utf8')
    .split('\n')
    .filter((line) => /^## \[\d+\.\d+\.\d+\]/.test(line));

  assert.ok(
    versions.length >= 2,
    `the canonical changelog lists ${versions.length} released version(s) — expected ` +
      `real history, so this check is not passing against an empty file`
  );
});

test('the archived pipeline changelog says what it is not', () => {
  assert.ok(
    fs.existsSync(ARCHIVE),
    'the archived planning-factory changelog is missing'
  );

  const text = fs.readFileSync(ARCHIVE, 'utf8');
  assert.match(
    text,
    /not the product changelog/i,
    'the archive must state plainly that it is not the product changelog — its whole ' +
      'history is being mistaken for one'
  );
});

test('the release role names the changelog by path in every instruction', () => {
  const text = fs.readFileSync(RELEASE_ROLE, 'utf8');
  const lines = text.split('\n');

  // ONLY THE INSTRUCTIONS, NOT THE PROSE EXPLAINING THEM.
  //
  // The first version of this flagged three lines in the "Which changelog" section
  // — the paragraph that DESCRIBES the old ambiguity and has to quote the bare name
  // to stay comprehensible. A guard that cannot tell "do this" from "this is what
  // went wrong" fails on its own documentation, which is a shape this repo has been
  // bitten by before (a contrast guard counting its own comment as a chip, a font
  // guard firing on its own banner).
  //
  // Instructions here are checklist items, table rows and numbered
  // responsibilities. That is what an agent acts on.
  const explanatory = (() => {
    const start = lines.findIndex((l) => l.startsWith('### Which changelog'));
    if (start === -1) return () => false;
    const end = lines.findIndex((l, i) => i > start && l.startsWith('### '));
    return (i) => i > start && (end === -1 || i < end);
  })();

  const isInstruction = (line) =>
    /^\s*[-*]\s*\[[ x]\]/.test(line) || // checklist item
    /^\s*\|/.test(line) || //             table row
    /^\s*\d+\.\s/.test(line); //          numbered responsibility

  const bare = lines
    .map((line, i) => ({ line, n: i + 1, i }))
    .filter(({ i }) => !explanatory(i))
    .filter(({ line }) => isInstruction(line))
    .filter(({ line }) => /(^|[^/\w-])CHANGELOG\.md/.test(line))
    .filter(({ line }) => !/PLANNING-FACTORY-CHANGELOG\.md/.test(line));

  assert.deepStrictEqual(
    bare.map(({ n, line }) => `${n}: ${line.trim()}`),
    [],
    'an instruction in the release role says "CHANGELOG.md" without a path. That is ' +
      'exactly what made the two files interchangeable — say docs/project/CHANGELOG.md.'
  );

  // The exclusions above could hide everything, so prove the check still has
  // something to look at.
  const instructions = lines.filter(
    (line, i) => !explanatory(i) && isInstruction(line)
  );
  assert.ok(
    instructions.length >= 10,
    `only ${instructions.length} instruction line(s) inspected — the filters have ` +
      `narrowed this check to nothing`
  );
});
