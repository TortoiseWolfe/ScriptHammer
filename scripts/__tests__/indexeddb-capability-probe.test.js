/**
 * The IndexedDB capability probe stays armed, and stays honest (#1209).
 *
 * WebKit cannot store a `Blob` or a `File` in IndexedDB. The probe exists because the
 * failure is silent — null `tx.error`, no throw at `put()`, and `fake-indexeddb` clones
 * binary unfaithfully — so nothing else in this repo can see it.
 *
 * WHAT THIS FILE PROTECTS, and why each half matters:
 *
 *  - All THREE engines are configured. The defect IS one engine disagreeing with the
 *    other two; a probe reduced to chromium measures nothing and still reports green.
 *  - The `ArrayBuffer` round trip is ASSERTED. That is the shape
 *    `src/lib/offline-queue/types.ts` tells a fork to use, so it has to be a gate.
 *  - The raw-Blob outcome is NOT asserted. Pinning "webkit fails" turns a future WebKit
 *    fix into a red build; pinning "webkit succeeds" fails today. Either would be a
 *    guard that lies about what it knows.
 *  - The constraint is written where someone would break it, not only in a workflow.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const CONFIG = 'playwright.idb.config.ts';
const SPEC = 'tests/idb/indexeddb-binary.spec.ts';
const WORKFLOW = '.github/workflows/indexeddb-capability.yml';

describe('IndexedDB binary-storage probe (#1209)', () => {
  it('probes all three engines', () => {
    const cfg = read(CONFIG);
    for (const browser of ['chromium', 'firefox', 'webkit']) {
      assert.match(
        cfg,
        new RegExp(`name:\\s*'${browser}'`),
        `${CONFIG} no longer configures ${browser}. The defect is ONE engine disagreeing ` +
          'with the other two, so a probe missing an engine cannot see it and still ' +
          'reports green (#1209).'
      );
    }
  });

  it('runs through the shared runner, never installing browsers', () => {
    const wf = read(WORKFLOW);
    assert.match(
      wf,
      /scripts\/ci\/playwright-in-container\.sh test --config playwright\.idb\.config\.ts/,
      'the probe must run via scripts/ci/playwright-in-container.sh (#829), which is also ' +
        'what playwright-runs-from-image.test.js requires of every workflow'
    );
    // STRIP YAML COMMENTS FIRST. The first version of this assertion matched the
    // workflow's own comment explaining why it never runs `playwright install` — a guard
    // failing on its own rationale, which is the same shape as a guard PASSING on its own
    // rationale and exactly the trap documented across this directory.
    const steps = wf
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    assert.ok(
      !/playwright\s+install/.test(steps),
      'no workflow may run `playwright install` — the browsers ship in the image (#829)'
    );
  });

  it('ASSERTS the storage shape the repo recommends', () => {
    const spec = read(SPEC);
    // Comments stripped first: this file and the spec both DISCUSS the assertion at
    // length, and a guard that matches its own prose passes with the code deleted.
    const code = spec
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.match(
      code,
      /roundTrip\(page,\s*'bytes'\)/,
      `${SPEC} no longer exercises the ArrayBuffer round trip, which is the shape ` +
        'src/lib/offline-queue/types.ts tells forks to use.'
    );
    assert.match(
      code,
      /\.toBe\(true\)/,
      'the ArrayBuffer round trip must be asserted, not merely measured'
    );
  });

  it('does NOT assert the raw-Blob outcome, in either direction', () => {
    const code = read(SPEC)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const blobCall = code.indexOf("roundTrip(page, 'blob')");
    assert.ok(blobCall > -1, `${SPEC} no longer measures the raw-Blob case`);
    const after = code.slice(blobCall);
    assert.ok(
      !/expect\([^)]*result\.ok[^)]*\)\s*\.\s*toBe\((true|false)\)/.test(after),
      'the raw-Blob outcome must not be asserted. Pinning "webkit fails" makes a future ' +
        'WebKit fix a red build; pinning "webkit succeeds" fails today. Report it (#1209).'
    );
  });

  it('records the constraint where someone would break it', () => {
    const types = read('src/lib/offline-queue/types.ts');
    assert.match(
      types,
      /WebKit cannot store a `Blob` or a `File` in IndexedDB/,
      'src/lib/offline-queue/types.ts is the interface a fork opens to add an attachment ' +
        'payload. A constraint recorded only in CI is a constraint they will not read.'
    );
    assert.match(
      types,
      /FileReader/,
      'the jsdom / older-Safari `Blob.prototype.arrayBuffer` gap must stay documented: ' +
        'without the fallback the write path throws, stores nothing, and tests still pass.'
    );
  });
});
