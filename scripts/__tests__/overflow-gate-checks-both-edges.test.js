/**
 * The open-menu overflow gate must measure BOTH viewport edges (#1022).
 *
 * WHY THIS NEEDS A GUARD OF ITS OWN. The nav panels are anchored by `-right-2`, so
 * their right edge is pinned near the trigger and any extra width grows LEFTWARD,
 * off the left edge of the screen. Measured at 320px by editing the panel's classes
 * live in a browser:
 *
 *     w-96 without max-w   ->  width 384px, left -121px, right 263px
 *
 * The right edge is INSIDE the viewport in the failing case. A right-edge-only
 * check therefore reports the one genuine overflow as clean, and it is the shape a
 * "simplification" of that filter would naturally take — `b.right > vw` reads like
 * the whole story.
 *
 * So this asserts the left half is still there. It matches SYNTAX rather than the
 * word "left", and strips comments first, because the spec's own header explains the
 * left-edge rule at length — a naive grep would match the prose and pass with the
 * code deleted, which is the failure this repo keeps filing.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const SPEC = path.join(
  __dirname,
  '..',
  '..',
  'tests',
  'e2e',
  'tests',
  'mobile-open-menu-overflow.spec.ts'
);

/** The left-edge comparison, as SYNTAX. */
const LEFT = /\.left\s*<\s*-?\d/;

/** Source with comments removed, so prose cannot satisfy a code assertion. */
function codeOnly() {
  return fs
    .readFileSync(SPEC, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('the open-menu overflow gate measures both edges (#1022)', () => {
  it('still exists at the path this guard points at', () => {
    // Without this the whole file passes vacuously if the spec is renamed or moved.
    assert.ok(
      fs.existsSync(SPEC),
      `${SPEC} is gone — point this guard at the spec rather than deleting it`
    );
  });

  it('checks the RIGHT edge', () => {
    assert.match(
      codeOnly(),
      /\.right\s*>\s*[A-Za-z_.$]+/,
      'the overflow filter no longer compares a right edge against the viewport'
    );
  });

  it('checks the LEFT edge, which is the one that catches a real overflow', () => {
    assert.match(
      codeOnly(),
      LEFT,
      'the overflow filter stopped checking the left edge. The nav panels are ' +
        'anchored by `-right-2`, so a panel that is too wide runs off the LEFT of ' +
        'the screen while its right edge stays comfortably inside — measured at ' +
        '320px: width 384px, left -121px, right 263px. Without this comparison ' +
        'the gate reports that as clean.'
    );
  });

  it('the matcher can actually fail, and comment-stripping is what makes it honest', () => {
    // The control, in three parts.
    const strip = (src) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    // 1. Real code matches.
    assert.match(strip('const bad = boxes.filter((b) => b.left < -1);'), LEFT);

    // 2. The SAME text inside a comment does not — this is the whole reason the
    //    guard strips first. Without stripping, the spec's own header prose about
    //    the left edge would satisfy the assertion with the code deleted.
    assert.doesNotMatch(strip('// b.left < -1 explains the rule'), LEFT);
    assert.doesNotMatch(strip('/* b.left < -1 in a block comment */'), LEFT);

    // 3. An empty file does not match, so a truncated read cannot pass.
    assert.doesNotMatch(strip(''), LEFT);
  });
});
