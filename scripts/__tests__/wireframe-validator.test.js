/**
 * CLI regression checks for the wireframe validator (#581).
 *
 * The validator is Python, while the repository's script-test entry point is
 * node:test. Exercise the public CLI so a directory argument cannot regress to
 * an unhandled Path.read_text() traceback.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const VALIDATOR = path.join(
  ROOT,
  '.specify',
  'extensions',
  'wireframe',
  'scripts',
  'validate.py'
);

test('wireframe validator rejects a directory argument without a traceback', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wireframe-validator-'));

  try {
    const result = spawnSync('python3', [VALIDATOR, directory], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.strictEqual(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /ERROR: Expected an SVG file, got directory:/);
    assert.doesNotMatch(result.stderr + result.stdout, /Traceback/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
