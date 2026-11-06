/**
 * No personal email address may appear in a User-Agent string.
 *
 * WHY. A `User-Agent` header goes to whichever website a script calls, and that
 * website can log it. Three scripts here put the maintainer's account email in
 * one ("polite client" habit copied from the Overpass and Nominatim usage
 * policies), so Overpass and the SketchUp 3D Warehouse received a personal
 * address on every request. A generic client name with a link to the repo is
 * what a polite client needs; an address is not.
 *
 * WHAT IT CHECKS. Every tracked source, script, workflow and doc file is read
 * line by line. A line that sets or documents a User-Agent (`User-Agent`,
 * `USER_AGENT`, `userAgent`) and also holds something shaped like an email
 * address fails the test, and the message names the file and line.
 *
 * WHY IT TESTS ITSELF FIRST. A detector that cannot report failure proves
 * nothing, so the first tests feed it known bad and known good lines.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const SELF = path.relative(ROOT, __filename);

const UA_WORD = /user[-_ ]?agent|\bUA\b/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;
const SCANNED = /\.(c?js|mjs|ts|tsx|sh|py|ya?ml|md)$/;

function leaksEmail(line) {
  return UA_WORD.test(line) && EMAIL.test(line);
}

test('detector flags an email on a User-Agent line', () => {
  const bad = [
    "export const USER_AGENT = 'tool/0.1 (someone@example.com)';",
    "headers: { 'User-Agent': 'tool/1.0 (someone@example.com)' },",
    'const userAgent = `bot (mailto:someone@example.org)`;',
    '- Overpass needs a User-Agent. Value: `bake/0.1 (someone@example.com)`.',
  ];
  for (const line of bad) assert.equal(leaksEmail(line), true, line);
});

test('detector passes lines that are fine', () => {
  const good = [
    "export const USER_AGENT = 'tool-tools/1.0 (+https://github.com/o/tool)';",
    "headers: { 'User-Agent': USER_AGENT },",
    "const to = 'someone@example.com';",
    'User-agent: *',
  ];
  for (const line of good) assert.equal(leaksEmail(line), false, line);
});

test('no tracked file puts an email address in a User-Agent', () => {
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((f) => SCANNED.test(f) && f !== SELF);

  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      continue; // listed by git but absent from this checkout
    }
    text.split('\n').forEach((line, i) => {
      if (leaksEmail(line)) hits.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(
    hits,
    [],
    `An email address sits on a User-Agent line. Use a generic client name ` +
      `such as "<repo>-tools/1.0 (+https://github.com/<owner>/<repo>)":\n` +
      hits.join('\n')
  );
});
