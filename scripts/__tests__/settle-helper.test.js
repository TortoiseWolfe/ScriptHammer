/**
 * `settleFrames` must have exactly one implementation, and must not regain a name that
 * promises more than it does (#739).
 *
 * It was `waitForUIStability`, copy-pasted into five messaging specs, and the name caused a
 * real hard failure: T009 used it to wait out a `behavior: 'smooth'` scroll and measured a
 * scroll that had barely started, failing with 2393px remaining against a 100px threshold —
 * on chromium in one run and firefox in the next. It observes nothing; the frames elapse
 * whether the UI settled or not.
 *
 * Five copies is also five places to fix when the lesson is next learned, which is why this
 * asserts there is exactly one.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const E2E = path.join(REPO_ROOT, 'tests', 'e2e');
const UTIL = path.join(E2E, 'utils', 'settle.ts');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

describe('the settle helper has one honest implementation (#739)', () => {
  const files = walk(E2E);

  it('the scan found the spec tree', () => {
    assert.ok(
      files.length > 20,
      `only ${files.length} .ts files under tests/e2e — stale path?`
    );
  });

  it('exactly one file defines it', () => {
    const definers = files
      .filter((f) =>
        /export async function settleFrames|async function settleFrames/.test(
          fs.readFileSync(f, 'utf8')
        )
      )
      .map((f) => f.replace(REPO_ROOT + '/', ''));
    assert.deepStrictEqual(
      definers,
      ['tests/e2e/utils/settle.ts'],
      'settleFrames is defined somewhere other than the shared util, or in more than one ' +
        'place. Five copies of its predecessor is what made #739 five bugs instead of one.'
    );
  });

  it('nothing reintroduces the name that lied', () => {
    const offenders = files
      .filter((f) => f !== UTIL)
      .filter((f) =>
        /function waitForUIStability/.test(fs.readFileSync(f, 'utf8'))
      )
      .map((f) => f.replace(REPO_ROOT + '/', ''));
    assert.deepStrictEqual(
      offenders,
      [],
      'a helper called waitForUIStability is back. It cannot wait for stability — it ' +
        'advances N animation frames and observes nothing. Use settleFrames, or better, ' +
        'assert the outcome with expect.poll.'
    );
  });

  it('the util documents the rule that caused #739', () => {
    const src = fs.readFileSync(UTIL, 'utf8');
    assert.ok(
      /does not retry|expect\.poll/.test(src),
      'the util no longer warns against putting it before a non-retrying measurement — ' +
        'which is the single mistake that produced #739'
    );
  });

  it('the control can fail — the definition detector works', () => {
    const fake = 'export async function settleFrames(page) {}';
    assert.ok(
      /export async function settleFrames|async function settleFrames/.test(
        fake
      ),
      'the detector cannot see a definition it should see'
    );
    assert.ok(
      !/function waitForUIStability/.test(fake),
      'the detector false-positives'
    );
  });
});
