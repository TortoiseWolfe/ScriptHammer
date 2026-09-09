/**
 * A missing artifact and a failing test must not read the same (#1130).
 *
 * WHAT HAPPENED. On run 34249189076, shards `chromium-gen 2/6` and `5/6` finished their
 * Playwright runs, uploaded their bytes, and were then refused at `FinalizeArtifact` with a
 * 403 on a 9.5 KB payload. Both shard JOBS were green. The aggregate counted 22 results.json
 * files where it expected 24, failed, and said:
 *
 *     only 22 of 24 shards reported
 *
 * which is true, and sent the reader to Playwright output for a failure that happened after
 * Playwright had finished. `E2E (local) result` is a REQUIRED check, so this also blocks
 * merges — with a message pointing at the wrong system.
 *
 * The aggregate already `needs: e2e-local`, so it can tell the two apart for free: if every
 * shard job SUCCEEDED and an artifact is still missing, the tests ran and passed and the
 * upload is what failed. Nothing else can produce that combination.
 *
 * IT STILL FAILS, AND THAT IS DELIBERATE. A verdict assembled from an incomplete set is not a
 * verdict — #934 is precisely what happens when an aggregate reconstructs one anyway. What
 * changes is which system it names.
 *
 * WHY THIS EXECUTES THE SCRIPT INSTEAD OF GREPPING IT. The aggregate is Python embedded in a
 * YAML `run:` block, so it has never been run by anything except CI. A guard that matched its
 * source text would pass with the logic inverted — this repo has burned four guards that way.
 * This extracts the heredoc and runs it against fixture shards.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WF = path.resolve(
  __dirname,
  '..',
  '..',
  '.github',
  'workflows',
  'e2e-local.yml'
);

/** The aggregate's Python, lifted out of the `Total the shards and compare` step. */
function aggregateSource() {
  const wf = fs.readFileSync(WF, 'utf8');
  const step = wf.slice(wf.indexOf('- name: Total the shards and compare'));
  const open = step.indexOf("python3 - <<'EOF'");
  assert.notStrictEqual(
    open,
    -1,
    'the aggregate no longer uses a python heredoc'
  );
  const body = step.slice(step.indexOf('\n', open) + 1);
  const end = body.search(/^\s*EOF\s*$/m);
  assert.notStrictEqual(end, -1, 'unterminated heredoc');
  // The block is indented inside the YAML; strip the common leading whitespace.
  const lines = body.slice(0, end).split('\n');
  const indent = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)
  );
  return lines.map((l) => l.slice(indent)).join('\n');
}

/** One shard's results.json holding `passed` passing tests. */
function shard(dir, n, passed, failed = 0) {
  const specs = [];
  for (let i = 0; i < passed; i++)
    specs.push({ tests: [{ status: 'expected' }] });
  for (let i = 0; i < failed; i++)
    specs.push({ tests: [{ status: 'unexpected' }] });
  const d = path.join(dir, 'shards', `s${n}`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(
    path.join(d, 'results.json'),
    JSON.stringify({ suites: [{ specs }] })
  );
}

/**
 * Run the aggregate over `shardCount` shards in chromium mode (8 expected).
 * The floor is ceil(1700*8/24) = 567, so each shard carries enough to clear it.
 */
function run({ shardCount, shardsResult, failedTests = 0 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agg-1130-'));
  for (let i = 0; i < shardCount; i++)
    shard(dir, i, 100, i === 0 ? failedTests : 0);
  const r = spawnSync('python3', ['-c', aggregateSource()], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      EXPECTED_SHARDS: '8',
      BROWSER_MODE: 'chromium',
      SHARDS_RESULT: shardsResult,
      TESTED_SHA: 'deadbeef',
    },
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** The workflow with full-line comments removed, so a guard cannot match its own rationale. */
function workflowCode() {
  return fs
    .readFileSync(WF, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
}

describe('the aggregate names the system that actually failed (#1130)', () => {
  it('the shard verdict is actually WIRED IN, not just read', () => {
    // THE GAP THIS CLOSES, found by mutation. Every other test here sets SHARDS_RESULT in the
    // environment itself, so they exercise the Python and say nothing about the workflow.
    // Renaming the env key in the YAML left all of them green while CI would have seen an
    // empty value and silently fallen back to the generic message — the defect restored, with
    // a passing suite over it.
    const code = workflowCode();
    assert.match(
      code,
      /SHARDS_RESULT:\s*\$\{\{\s*needs\['e2e-local'\]\.result\s*\}\}/,
      "the aggregate step no longer receives needs['e2e-local'].result as SHARDS_RESULT, so " +
        'it cannot tell a missing artifact from a failing test (#1130). Note the bracket ' +
        'syntax: `needs.e2e-local.result` does not parse, because the job id has a hyphen.'
    );
    assert.match(
      code,
      /os\.environ\.get\("SHARDS_RESULT"/,
      'the aggregate no longer reads SHARDS_RESULT'
    );
  });

  it('CONTROL: a complete, passing run succeeds', () => {
    // Without this the assertions below could be satisfied by a script that always fails.
    const r = run({ shardCount: 8, shardsResult: 'success' });
    assert.strictEqual(r.code, 0, r.out);
  });

  it('names the UPLOAD when every shard job passed but artifacts are missing', () => {
    const r = run({ shardCount: 6, shardsResult: 'success' });
    assert.notStrictEqual(
      r.code,
      0,
      'an incomplete set must still fail (#934)'
    );
    assert.match(
      r.out,
      /UPLOAD is what\s+failed|upload/i,
      `the operator is not told the upload failed:\n${r.out}`
    );
    assert.match(
      r.out,
      /FinalizeArtifact/,
      'the actual failing API is not named'
    );
    assert.doesNotMatch(
      r.out,
      /test\(s\) failed/,
      'it still reports failing tests when none failed — that is the #1130 defect'
    );
  });

  it('does NOT blame the upload when the shard matrix itself failed', () => {
    // The differential. If this said "upload" too, the message would be a constant rather
    // than a diagnosis, and the previous test would prove nothing.
    const r = run({ shardCount: 6, shardsResult: 'failure' });
    assert.notStrictEqual(r.code, 0);
    assert.doesNotMatch(
      r.out,
      /FinalizeArtifact/,
      'a genuinely failed shard matrix was reported as an upload problem'
    );
    assert.match(r.out, /only 6 of 8 shards reported/);
    assert.match(r.out, /shard matrix result: failure/);
  });

  it('still reports failing tests as failing tests', () => {
    const r = run({ shardCount: 8, shardsResult: 'success', failedTests: 3 });
    assert.notStrictEqual(r.code, 0);
    assert.match(r.out, /3 test\(s\) failed/);
    assert.doesNotMatch(r.out, /FinalizeArtifact/);
  });
});
