/**
 * Whatever the E2E lane captures on failure must actually be uploaded (#766).
 *
 * WHAT WENT WRONG. `playwright.config.ts` collects a trace on first retry, a video on
 * failure and a screenshot on failure, all into `outputDir: 'test-results/'` — and that
 * directory appeared in no upload path. The lane paid for the diagnostics on every
 * failing run and threw them away.
 *
 * It was invisible in the worst way: the failure output *advertises* them. Playwright
 * prints `pnpm exec playwright show-trace test-results/…/trace.zip`, naming a file the
 * run has already discarded. That cost real time on #757, where three occurrences were
 * diagnosed from log text alone because the trace the log pointed at did not exist —
 * and the person diagnosing it first asserted the traces WERE available, because the
 * log said so.
 *
 * WHY A TEST. The capture settings and the upload paths live in two different files,
 * hundreds of lines apart, with nothing relating them. Either can change without the
 * other, and neither failing tells you the pair has come apart. This relates them.
 *
 * WHAT THIS CANNOT CHECK: that the artifact is actually retrievable, or that a trace
 * inside it opens. It asserts the plumbing is connected, not that the plumbing carries
 * water — stated so a green run is not over-read.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'playwright.config.ts');
const LOCAL_LANE = path.join(ROOT, '.github', 'workflows', 'e2e-local.yml');

/** The directory Playwright writes traces, videos and screenshots into. */
function outputDir(src) {
  const m = /outputDir:\s*'([^']+)'/.exec(src);
  return m ? m[1].replace(/\/$/, '') : null;
}

/** Which artefacts the config asks for, ignoring the ones switched off. */
function capturedKinds(src) {
  const kinds = [];
  for (const key of ['trace', 'video', 'screenshot']) {
    const m = new RegExp(`^\\s*${key}:\\s*'([^']+)'`, 'm').exec(src);
    if (m && m[1] !== 'off') kinds.push(`${key}: ${m[1]}`);
  }
  return kinds;
}

/**
 * The workflow's steps, split on `- name:` boundaries.
 *
 * Scanning for the bare directory name instead was wrong twice over: the first hit was
 * a COMMENT in the step's own explanation, which pointed the check at the previous
 * step, and slicing only up to the path would miss an `if:` written below it.
 */
function steps(lane) {
  const out = [];
  const re = /^\s*- name:.*$/gm;
  const starts = [...lane.matchAll(re)].map((m) => m.index);
  for (let i = 0; i < starts.length; i++) {
    out.push(lane.slice(starts[i], starts[i + 1] ?? lane.length));
  }
  return out;
}

/** The step that uploads `dir`, ignoring any step that merely mentions it in prose. */
function uploadStepFor(lane, dir) {
  const uploads = new RegExp(`^\\s*(-\\s+)?(path:\\s*)?${dir}/?\\s*$`, 'm');
  return steps(lane).find((s) =>
    s
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .some((l) => uploads.test(l))
  );
}

/**
 * The id of the step whose `flaky` output also opens the upload gate, or null.
 * Requires `failure()` AND the flaky output compared to 'true' on one `if:` line.
 */
function flakyGateStepId(block) {
  const m =
    /^\s*if:\s*failure\(\)\s*\|\|\s*steps\.([\w-]+)\.outputs\.flaky\s*==\s*'true'\s*$/m.exec(
      block
    );
  return m ? m[1] : null;
}

describe('the lane uploads the diagnostics it captures (#766)', () => {
  it('reads both files and finds a real output directory', () => {
    // Non-vacuity. If either parse breaks, every assertion below would pass against
    // nothing — the #396 shape this repo keeps paying for.
    const cfg = fs.readFileSync(CONFIG, 'utf8');

    assert.ok(
      outputDir(cfg),
      'could not find outputDir in playwright.config.ts'
    );
    assert.ok(
      capturedKinds(cfg).length >= 2,
      `expected the config to capture several artefact kinds, found ${capturedKinds(cfg).length}`
    );
  });

  it('uploads the configured output directory somewhere', () => {
    const cfg = fs.readFileSync(CONFIG, 'utf8');
    const lane = fs.readFileSync(LOCAL_LANE, 'utf8');
    const dir = outputDir(cfg);

    // Both spellings count: a bare list item under `path: |`, or an inline
    // `path: test-results/`. The property is that the directory is uploaded, not
    // which YAML form somebody used — the first version of this check only accepted
    // the list form and failed on the very fix it was written to protect.
    assert.ok(
      uploadStepFor(lane, dir),
      `playwright.config.ts captures ${capturedKinds(cfg).join(', ')} into '${dir}/', ` +
        `but no upload step in e2e-local.yml lists that path. The lane pays for those ` +
        `artefacts on every failing run and discards them — and the failure output ` +
        `prints a 'show-trace' command naming a file that no longer exists (#766).`
    );
  });

  it('does not upload them on green runs', () => {
    // The other half. Uploading test-results/ unconditionally from 24 shards trades
    // one waste for another, so the diagnostics step must be gated on failure (and,
    // since #1524, on a flaky test: the next test covers that half).
    const lane = fs.readFileSync(LOCAL_LANE, 'utf8');
    const cfg = fs.readFileSync(CONFIG, 'utf8');
    const dir = outputDir(cfg);

    const block = uploadStepFor(lane, dir);
    assert.ok(block, 'output directory is not uploaded at all');

    assert.match(
      block,
      /if:\s*failure\(\)/,
      `the step uploading '${dir}/' is not gated on failure(). On a green run that ` +
        `directory is noise, and 24 shards uploading it every time is the waste this ` +
        `fix was meant to avoid.`
    );
  });

  it('also uploads them when a test flaked, so a flake carries its own evidence (#1524)', () => {
    // A flaky test passes on its retry: the shard is green and `failure()` is false,
    // so a failure-only gate threw away the screenshot, video and error-context of
    // the attempt that failed. landmarks.spec.ts:256 flaked once with no evidence.
    const lane = fs.readFileSync(LOCAL_LANE, 'utf8');
    const dir = outputDir(fs.readFileSync(CONFIG, 'utf8'));
    const block = uploadStepFor(lane, dir);
    assert.ok(block, 'output directory is not uploaded at all');

    const id = flakyGateStepId(block);
    assert.ok(
      id,
      `the step uploading '${dir}/' must also run when a test flaked: expected ` +
        `\`if: failure() || steps.<id>.outputs.flaky == 'true'\` (#1524).`
    );

    // The step it points at must exist, run even after a failure, and read the count
    // Playwright writes to results.json. Otherwise the gate reads an output nobody sets
    // and is silently always false.
    const detector = steps(lane).find((s) =>
      new RegExp(`^\\s*id:\\s*${id}\\s*$`, 'm').test(s)
    );
    assert.ok(
      detector,
      `no step has id '${id}', so the upload gate is always false`
    );
    assert.match(
      detector,
      /if:\s*always\(\)/,
      'the flaky check must run after a failed step too'
    );
    assert.match(
      detector,
      /\.stats\.flaky/,
      'the flaky check must read stats.flaky from results.json'
    );
    assert.match(detector, /flaky=true/, 'the flaky check must set flaky=true');

    // Order matters: a step output read before its step has run is an empty string,
    // with no error, so the gate would be silently always false.
    const all = steps(lane);
    assert.ok(
      all.indexOf(detector) < all.indexOf(block),
      'the flaky check must come BEFORE the upload that reads its output'
    );
  });

  it('the detector can actually fail', () => {
    // The flaky-gate parser: it must accept the real shape and refuse near misses.
    assert.equal(
      flakyGateStepId("if: failure() || steps.flaky.outputs.flaky == 'true'"),
      'flaky'
    );
    assert.equal(
      flakyGateStepId('if: failure()'),
      null,
      'failure-only has no flaky gate'
    );
    assert.equal(
      flakyGateStepId("if: steps.flaky.outputs.flaky == 'true'"),
      null,
      'a gate without failure() would skip real failures'
    );
    assert.equal(
      flakyGateStepId("if: failure() || steps.flaky.outputs.flaky == 'false'"),
      null,
      'comparing to false is not a flaky gate'
    );

    // Controls. A parser that returned null for everything would report the repo as
    // correct, and a matcher that accepted any string would never catch a regression.
    assert.equal(outputDir("outputDir: 'test-results/',"), 'test-results');
    assert.equal(outputDir('nothing here'), null);

    const cfgOn =
      "trace: 'on-first-retry',\nvideo: 'retain-on-failure',\nscreenshot: 'off',";
    assert.deepEqual(capturedKinds(cfgOn), [
      'trace: on-first-retry',
      'video: retain-on-failure',
    ]);

    // A path that merely CONTAINS the directory name must not satisfy the check —
    // `playwright-report/` is not `test-results/`.
    const near = (body) => uploadStepFor(body, 'test-results');

    assert.ok(
      near('      - name: up\n        path: test-results/\n'),
      'inline path counts'
    );
    assert.ok(
      near('      - name: up\n        path: |\n          test-results/\n'),
      'bare list item counts'
    );
    assert.equal(
      near('      - name: up\n        path: playwright-report/\n'),
      undefined,
      'a different directory must not satisfy it'
    );

    // The two bugs this helper was written for, pinned so they cannot come back:
    // a mention in PROSE is not an upload, and an `if:` BELOW the path still counts.
    assert.equal(
      near(
        '      - name: talk\n        # writes into test-results/\n        run: x\n'
      ),
      undefined,
      'a comment mentioning the directory is not an upload'
    );
    assert.match(
      near(
        '      - name: up\n        path: test-results/\n        if: failure()\n'
      ),
      /if:\s*failure\(\)/,
      'the whole step is scanned, not just the text above the path'
    );
  });
});
