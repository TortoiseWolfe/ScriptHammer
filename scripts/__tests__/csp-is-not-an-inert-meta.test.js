/**
 * The CSP must never go back into `metadata.other` (#393).
 *
 * WHAT WENT WRONG. `src/app/layout.tsx` carried a ten-directive Content-Security-Policy
 * under Next's `metadata.other`. That renders `<meta name="Content-Security-Policy">`,
 * and a CSP in `<meta name>` form is **inert** — browsers honour only `<meta http-equiv>`
 * or the HTTP header. The policy was authored, reviewed and maintained for months, and
 * enforced exactly never. It was confirmed behaviourally, not by inspection: loading a
 * stylesheet from an origin the policy excludes fired `onload` and produced zero
 * `securitypolicyviolation` events.
 *
 * WHY THIS TEST IS SHAPED THIS WAY. #393 asks for "a test that asserts the delivery
 * mechanism, not the policy string — one that would have failed for the whole life of
 * this bug". A test over the policy's CONTENT would have passed happily throughout: the
 * directives were all correct. Only the delivery was wrong.
 *
 * WHAT IT CANNOT CHECK: that production actually serves the header. That lives in a
 * Cloudflare Transform Rule outside this repo, and only `scripts/ci/check-csp-header.mjs`
 * running against the live origin in `smoke.yml` can see it. This test guards the repo
 * half; that script guards the half that matters.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const LAYOUT = path.join(ROOT, 'src', 'app', 'layout.tsx');
const CHECK = path.join(ROOT, 'scripts', 'ci', 'check-csp-header.mjs');
const SMOKE = path.join(ROOT, '.github', 'workflows', 'smoke.yml');

const layout = () => fs.readFileSync(LAYOUT, 'utf8');

/** The body of the `other: { … }` metadata block, which renders as <meta name>. */
function metadataOtherBlock(src) {
  const start = src.indexOf('other: {');
  if (start === -1) return null;
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

/** Lines that are actual code, not comments — a comment may name the header freely. */
function codeLines(block) {
  return block
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
}

describe('the CSP is not delivered as an inert meta tag (#393)', () => {
  it('finds the metadata block, so the assertion below is not vacuous', () => {
    const block = metadataOtherBlock(layout());
    assert.ok(block, 'could not locate `other: {` in layout.tsx');
    assert.ok(
      block.length > 100,
      'the parsed metadata block is implausibly short'
    );
  });

  it('no Content-Security-Policy is set through metadata.other', () => {
    const block = codeLines(metadataOtherBlock(layout()));
    assert.doesNotMatch(
      block,
      /['"]Content-Security-Policy['"]\s*:/i,
      'A CSP is back in `metadata.other`. That renders `<meta name="...">`, which every ' +
        'browser IGNORES — the policy would look present and enforce nothing, which is ' +
        'exactly the bug #393 fixed. The policy belongs in the Cloudflare Response Header ' +
        'Transform Rule; `scripts/ci/check-csp-header.mjs` verifies it against live prod.'
    );
  });

  it('the live check exists and smoke.yml runs it', () => {
    // The repo half is worthless on its own: with the policy out of the build, this
    // file could pass forever while production served no CSP at all.
    assert.ok(
      fs.existsSync(CHECK),
      'scripts/ci/check-csp-header.mjs is missing'
    );
    assert.match(
      fs.readFileSync(SMOKE, 'utf8'),
      /check-csp-header\.mjs/,
      'smoke.yml no longer runs the live CSP check, so nothing observes the Cloudflare rule'
    );
  });

  it('the detector can actually fail', () => {
    // Controls. A parser returning null for everything would report the repo clean.
    const withCsp = `other: {\n  'Content-Security-Policy': ['a'].join('; '),\n},`;
    const without = `other: {\n  Pragma: 'no-cache',\n},`;
    assert.match(
      codeLines(metadataOtherBlock(withCsp)),
      /Content-Security-Policy/
    );
    assert.doesNotMatch(
      codeLines(metadataOtherBlock(without)),
      /Content-Security-Policy/
    );

    // A COMMENT mentioning the header must not trip it — layout.tsx now explains at
    // length why the policy is absent, and that prose names the header repeatedly.
    const commented = `other: {\n  // no 'Content-Security-Policy': here, see #393\n  Pragma: 'x',\n},`;
    assert.doesNotMatch(
      codeLines(metadataOtherBlock(commented)),
      /Content-Security-Policy/
    );

    assert.equal(metadataOtherBlock('no metadata here'), null);
  });
});
