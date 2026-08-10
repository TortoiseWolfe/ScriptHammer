/**
 * The Keep-Alive workflow must reject a syntactically non-empty project list
 * that yields zero refs. `REFS=", ,"` used to skip the loop and exit 0, which
 * is indistinguishable from successfully keeping every project awake.
 *
 * Run the exact shell body from the workflow with a fake curl, rather than a
 * copied implementation. A test that only inspected a string would let the
 * workflow drift away from the behavior it claims to protect.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(
  REPO_ROOT,
  '.github',
  'workflows',
  'supabase-keepalive.yml'
);

/** Extract the exact `run: |` body from the Ping every project workflow step. */
function pingScript() {
  const lines = fs.readFileSync(WORKFLOW, 'utf8').split(/\r?\n/);
  const step = lines.findIndex(
    (line) => line === '      - name: Ping every project'
  );
  assert.notStrictEqual(step, -1, 'Ping every project step is missing');

  const run = lines.findIndex(
    (line, index) => index > step && line === '        run: |'
  );
  assert.notStrictEqual(run, -1, 'Ping every project run block is missing');

  const body = [];
  for (let index = run + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith('          ')) {
      body.push(line.slice(10));
      continue;
    }
    if (line === '') {
      body.push('');
      continue;
    }
    break;
  }

  assert.ok(body.length > 0, 'Ping every project run block is empty');
  return body.join('\n');
}

/** Run the workflow body locally with curl forced to a successful HTTP 200. */
function runKeepalive(refs, script = pingScript()) {
  const work = fs.mkdtempSync(
    path.join(os.tmpdir(), 'scripthammer-keepalive-')
  );
  const bin = path.join(work, 'bin');
  const summary = path.join(work, 'summary.md');
  fs.mkdirSync(bin);
  const curl = path.join(bin, 'curl');
  fs.writeFileSync(curl, '#!/bin/sh\nprintf 200\n');
  fs.chmodSync(curl, 0o755);

  try {
    const result = spawnSync('bash', ['-e', '-c', script], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`,
        REFS: refs,
        TOKEN_A: 'test-token',
        TOKEN_B: '',
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    assert.ifError(result.error);
    return {
      ...result,
      summary: fs.existsSync(summary) ? fs.readFileSync(summary, 'utf8') : '',
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const EMPTY_LIST_GUARD = [
  '# `REFS=", ,"` is not shell-empty, but produces no loop iterations.',
  '# A keepalive that reports success after pinging nothing is worse than a',
  '# red scheduled run: it lets every project pause while looking healthy.',
  'if [ "$processed_refs" -eq 0 ]; then',
  '  echo "::error::vars.SUPABASE_KEEPALIVE_REFS contains no usable project refs — nothing is being kept alive"',
  '  fail=1',
  'fi',
].join('\n');

describe('Supabase Keep-Alive workflow', () => {
  it('rejects a comma-and-whitespace list that would ping no projects', () => {
    const result = runKeepalive(' , , ');

    assert.strictEqual(result.status, 1, result.stderr);
    assert.match(result.stdout, /contains no usable project refs/);
  });

  it('still pings every usable comma-separated project ref', () => {
    const result = runKeepalive('alpha,beta');

    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /OK    alpha/);
    assert.match(result.stdout, /OK    beta/);
    assert.match(result.summary, /`alpha` \| ✅ pinged/);
    assert.match(result.summary, /`beta` \| ✅ pinged/);
  });

  it('negative control: removing the zero-ref guard restores the false success', () => {
    const script = pingScript();
    const withoutGuard = script.replace(EMPTY_LIST_GUARD, '');
    assert.notStrictEqual(
      withoutGuard,
      script,
      'the test control could not remove the zero-ref guard'
    );

    const result = runKeepalive(' , , ', withoutGuard);
    assert.strictEqual(
      result.status,
      0,
      'without the guard, an empty parsed list would falsely report success'
    );
  });
});
