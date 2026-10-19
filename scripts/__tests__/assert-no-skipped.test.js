/**
 * scripts/ci/assert-no-skipped.mjs must fail on any skipped/todo test and on a
 * report it cannot trust, and pass on a clean one (#1379).
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'ci', 'assert-no-skipped.mjs');

function report(statuses, extra = {}) {
  const assertionResults = statuses.map((status, i) => ({
    status,
    title: `t${i}`,
    fullName: `suite t${i}`,
  }));
  return {
    numTotalTests: statuses.length,
    numPendingTests: statuses.filter((s) => s === 'pending').length,
    numTodoTests: statuses.filter((s) => s === 'todo').length,
    testResults: [{ name: 'tests/rls/x.test.ts', assertionResults }],
    ...extra,
  };
}

function run(obj, raw) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nosk-'));
  const file = path.join(dir, 'r.json');
  fs.writeFileSync(file, raw ?? JSON.stringify(obj));
  const res = spawnSync('node', [SCRIPT, file], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return res;
}

describe('assert-no-skipped', () => {
  it('passes when every test passed', () => {
    const res = run(report(['passed', 'passed', 'passed']));
    assert.strictEqual(res.status, 0, res.stderr);
  });

  it('fails and names a skipped test', () => {
    const res = run(report(['passed', 'pending']));
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /suite t1/);
  });

  it('fails on a todo test', () => {
    const res = run(report(['passed', 'todo']));
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /suite t1/);
  });

  it('fails when counters show skips that no row names', () => {
    const res = run(report(['passed'], { numPendingTests: 3 }));
    assert.strictEqual(res.status, 1);
  });

  it('fails closed on an empty report', () => {
    assert.strictEqual(run(report([])).status, 1);
  });

  it('fails closed on unparseable input', () => {
    assert.strictEqual(run(null, 'not json').status, 1);
  });

  it('fails closed when the file is missing', () => {
    const res = spawnSync('node', [SCRIPT, '/nonexistent/r.json'], {
      encoding: 'utf8',
    });
    assert.strictEqual(res.status, 1);
  });
});
