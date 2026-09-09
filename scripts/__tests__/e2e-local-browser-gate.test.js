/**
 * The required local E2E lane must select browsers before runner allocation (#950).
 *
 * A step-level gate still creates all 24 matrix jobs, so it does not remove the queue.
 * The `changes` job instead emits a browser axis consumed by the matrix: ordinary PRs
 * get Chromium's eight shards; push, dispatch, and `full-e2e` PR events get all 24.
 * The aggregate must consume the same plan or its old literal 24-shard gate makes every
 * ordinary PR red.
 *
 * These checks strip comments before matching. The workflow explains every invariant in
 * prose, and matching that prose is how several earlier guards became unable to fail.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'e2e-local.yml');
const CLAUDE = path.join(ROOT, 'CLAUDE.md');
const RAW = fs.readFileSync(WORKFLOW, 'utf8');

function stripComments(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function between(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start === -1) return '';
  const rest = text.slice(start);
  const end = rest.indexOf(endNeedle, startNeedle.length);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Apply a mutation and PROVE it applied.
 *
 * `String.prototype.replace` with a needle that is not present returns the input unchanged and
 * says nothing. Every CONTROL below then asserts against unmutated source, finds no errors, and
 * reports the guard as broken — or, worse, the assertion is `.length > 0` on something that was
 * never mutated and the control silently stops controlling anything.
 *
 * That is not hypothetical. #1135 changed the selector expression, which turned the `noPush`
 * mutation below into a no-op; the control failed with "Chromium-only push was accepted" while
 * the real defect was that nothing had been replaced. The same shape cost two other guards in
 * this repo on 2026-09-09 alone.
 */
function mutate(text, from, to) {
  const out = text.replace(from, to);
  assert.notStrictEqual(
    out,
    text,
    `mutation did not apply — the needle is gone, so this control tests nothing: ${String(from).slice(0, 70)}`
  );
  return out;
}

function normalizedLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function triggerErrors(text) {
  const errors = [];
  const trigger = between(text, 'on:\n', 'jobs:\n');
  if (
    !/^  pull_request:\n    branches: \[main\]\n    types: \[opened, synchronize, reopened, labeled\]$/m.test(
      trigger
    )
  ) {
    errors.push('pull requests no longer include the full-e2e label event');
  }
  return errors;
}

function shellAssignments(branch) {
  return Object.fromEntries(
    [
      ...branch.matchAll(/^\s*(browsers|expected_shards|browser_mode)=(.+)$/gm),
    ].map(([, name, value]) => [name, value.trim()])
  );
}

function selectionErrors(changes) {
  const errors = [];
  const selector = between(
    changes,
    '      - name: Select browser coverage',
    '      - uses: actions/checkout@v5'
  );
  if (!/^        id: browsers$/m.test(selector)) {
    errors.push('selector step has no stable browsers id');
  }

  const env = selector.match(
    /E2E_FULL_BROWSERS:\s*>-\s*([\s\S]*?)\n        run: \|/
  );
  const expression = env?.[1].replace(/\s+/g, ' ').trim();
  const expectedExpression =
    "${{ github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' || contains(github.event.pull_request.labels.*.name, 'full-e2e') }}";
  if (expression !== expectedExpression) {
    errors.push(`browser event expression changed: ${expression || 'missing'}`);
  }

  const scriptStart = selector.indexOf('        run: |');
  const script = scriptStart === -1 ? '' : selector.slice(scriptStart + 14);
  const expectedScript = [
    'if [ "$E2E_FULL_BROWSERS" = "true" ]; then',
    'browsers=\'["chromium","firefox","webkit"]\'',
    'expected_shards=24',
    'browser_mode=full',
    'else',
    'browsers=\'["chromium"]\'',
    'expected_shards=8',
    'browser_mode=chromium',
    'fi',
    '{',
    'echo "browsers=$browsers"',
    'echo "expected_shards=$expected_shards"',
    'echo "browser_mode=$browser_mode"',
    '} >> "$GITHUB_OUTPUT"',
    'echo "browser mode: $browser_mode ($expected_shards shards)"',
  ];
  if (
    JSON.stringify(normalizedLines(script)) !== JSON.stringify(expectedScript)
  ) {
    errors.push(
      'selector run script is not the exact event-to-matrix contract'
    );
  }

  const branch = selector.match(
    /^\s*if \[ "\$E2E_FULL_BROWSERS" = "true" \]; then\n([\s\S]*?)^\s*else\n([\s\S]*?)^\s*fi\s*$/m
  );
  if (!branch) {
    errors.push('selector no longer uses a positive true branch');
  } else {
    const full = shellAssignments(branch[1]);
    const ordinary = shellAssignments(branch[2]);
    const expectedFull = {
      browsers: `'["chromium","firefox","webkit"]'`,
      expected_shards: '24',
      browser_mode: 'full',
    };
    const expectedOrdinary = {
      browsers: `'["chromium"]'`,
      expected_shards: '8',
      browser_mode: 'chromium',
    };
    if (JSON.stringify(full) !== JSON.stringify(expectedFull)) {
      errors.push(`full branch changed: ${JSON.stringify(full)}`);
    }
    if (JSON.stringify(ordinary) !== JSON.stringify(expectedOrdinary)) {
      errors.push(`ordinary PR branch changed: ${JSON.stringify(ordinary)}`);
    }
  }

  for (const output of ['browsers', 'expected_shards', 'browser_mode']) {
    const mapping = new RegExp(
      `^      ${output}: \\$\\{\\{ steps\\.browsers\\.outputs\\.${output} \\}\\}$`,
      'm'
    );
    if (!mapping.test(changes)) {
      errors.push(`changes output ${output} is not wired to the selector`);
    }
    const emission = new RegExp(
      `^            echo "${output}=\\$${output}"$`,
      'm'
    );
    if (!emission.test(selector)) {
      errors.push(`selector does not emit ${output}`);
    }
  }
  if (!/^          \} >> "\$GITHUB_OUTPUT"$/m.test(selector)) {
    errors.push('selector output group is not appended to GITHUB_OUTPUT');
  }
  return errors;
}

/**
 * The three things #1135 newly made breakable.
 *
 * Moving cross-browser off every merge onto a nightly creates a failure mode that did not exist
 * before: coverage can now vanish ENTIRELY and silently. Previously `event_name != 'pull_request'`
 * meant any merge ran all three browsers, so a mistake here cost minutes. Now, delete the cron and
 * firefox/webkit run NOWHERE — every PR is chromium-8 and every merge is chromium-8, all green,
 * with two browsers untested indefinitely. Nothing else in the repo would notice.
 */
function nightlyErrors(text) {
  const errors = [];
  const trigger = between(text, 'on:\n', 'jobs:\n');

  // 1. The nightly must exist. This is the load-bearing one.
  if (!/^  schedule:\n    - cron: '[^']+'$/m.test(trigger)) {
    errors.push(
      'the nightly cron is gone — with cross-browser off merges (#1135), firefox and webkit ' +
        'then run nowhere at all, and every check stays green while two browsers go untested'
    );
  }

  // 2. A plain push must NOT buy the full matrix — that is the thing being removed.
  const selector = between(
    text,
    '      - name: Select browser coverage',
    '      - uses: actions/checkout@v5'
  );
  if (/github\.event_name\s*!=\s*'pull_request'/.test(selector)) {
    errors.push(
      "the selector is back to `event_name != 'pull_request'`, which gives every merge the " +
        '24-shard matrix its own PR deliberately ran at 8 (#1135)'
    );
  }

  // 3. A schedule event must short-circuit Decide. It has no `github.event.before`, so the
  //    push branch would diff against HEAD^1 and skip the suite on most nights — a nightly
  //    that silently does nothing is worse than no nightly, because the cron looks healthy.
  const decide = between(text, '      - name: Decide', '\n  e2e-local:');
  if (!/=\s*"schedule"\s*\]\s*;?\s*then/.test(decide.replace(/\n/g, ' '))) {
    errors.push(
      'Decide no longer short-circuits on `schedule`. A schedule event carries no ' +
        '`github.event.before`, so it falls into the push branch, diffs against HEAD^1, and ' +
        'the nightly cross-browser run skips itself while reporting success (#1135)'
    );
  }
  return errors;
}

function matrixErrors(text) {
  const errors = [];
  if (
    !/browser:\s*\$\{\{\s*fromJSON\(needs\.changes\.outputs\.browsers\)\s*\}\}/.test(
      text
    )
  ) {
    errors.push('matrix browser axis is not derived from the changes output');
  }

  const matrixBlock = between(text, '      matrix:', '\n\n    steps:');
  const expectedMatrix = [
    'matrix:',
    'browser: ${{ fromJSON(needs.changes.outputs.browsers) }}',
    'slice:',
    '- { project: msg, shard: 1/1 }',
    '- { project: msg-iso, shard: 1/1, workers: 2 }',
    '- { project: gen, shard: 1/6 }',
    '- { project: gen, shard: 2/6 }',
    '- { project: gen, shard: 3/6 }',
    '- { project: gen, shard: 4/6 }',
    '- { project: gen, shard: 5/6 }',
    '- { project: gen, shard: 6/6 }',
  ];
  if (
    JSON.stringify(normalizedLines(matrixBlock)) !==
    JSON.stringify(expectedMatrix)
  ) {
    errors.push('matrix block is not the exact browser × eight-slice contract');
  }
  const axes = [...matrixBlock.matchAll(/^        ([a-z][\w-]*):/gm)].map(
    (match) => match[1]
  );
  if (JSON.stringify(axes) !== JSON.stringify(['browser', 'slice'])) {
    errors.push(`matrix axes are not exactly browser × slice: ${axes}`);
  }

  const rows = [...matrixBlock.matchAll(/^\s*-\s*\{([^}]+)\}/gm)].map((match) =>
    match[1].replace(/\s+/g, ' ').trim()
  );
  const expectedRows = [
    'project: msg, shard: 1/1',
    'project: msg-iso, shard: 1/1, workers: 2',
    'project: gen, shard: 1/6',
    'project: gen, shard: 2/6',
    'project: gen, shard: 3/6',
    'project: gen, shard: 4/6',
    'project: gen, shard: 5/6',
    'project: gen, shard: 6/6',
  ];
  if (JSON.stringify(rows) !== JSON.stringify(expectedRows)) {
    errors.push(`matrix slices changed: ${JSON.stringify(rows)}`);
  }
  if (
    !/--project=\$\{\{ matrix\.browser \}\}-\$\{\{ matrix\.slice\.project \}\}/.test(
      text
    )
  ) {
    errors.push('Playwright project is not composed from browser + slice');
  }
  if (!/--shard=\$\{\{ matrix\.slice\.shard \}\}/.test(text)) {
    errors.push('Playwright shard is not read from the selected slice');
  }
  if (!/^          WORKERS: \$\{\{ matrix\.slice\.workers \}\}$/m.test(text)) {
    errors.push('workers override is not read from the selected slice');
  }
  return errors;
}

function aggregateErrors(text) {
  const errors = [];
  if (
    !/^\s*EXPECTED_SHARDS:\s*\$\{\{\s*needs\.changes\.outputs\.expected_shards\s*\}\}/m.test(
      text
    )
  ) {
    errors.push('aggregate does not consume the selector shard count');
  }
  if (
    !/^\s*BROWSER_MODE:\s*\$\{\{\s*needs\.changes\.outputs\.browser_mode\s*\}\}/m.test(
      text
    )
  ) {
    errors.push('aggregate does not consume the selector browser mode');
  }
  if (
    !/expected_shards\s*=\s*int\(os\.environ\["EXPECTED_SHARDS"\]\)/.test(text)
  ) {
    errors.push('aggregate does not parse EXPECTED_SHARDS');
  }
  if (!/len\(files\)\s*!=\s*expected_shards/.test(text)) {
    errors.push('artifact completeness is not checked against expected_shards');
  }
  if (/len\(files\)\s*!=\s*24/.test(text)) {
    errors.push('literal 24-shard artifact gate survived');
  }
  if (
    !/FLOOR\s*=\s*\(FULL_FLOOR \* expected_shards \+ 23\) \/\/ 24/.test(text)
  ) {
    errors.push('anti-vacuity floor is not scaled with the selected matrix');
  }
  const subset = text.indexOf('if browser_mode != "full":');
  const baseline = text.indexOf('on_baseline =');
  const subsetBlock = text.slice(subset, baseline);
  const expectedSubset = [
    'if browser_mode != "full":',
    'print("")',
    'print(f"Artifact totals OK: {expected_shards}/{expected_shards} shards, 0 failures, above the floor.")',
    'print("The shard matrix\'s OWN verdict is a separate step after this one")',
    'print("— these totals cannot see a shard that failed after reporting (#934).")',
    'print("COUNT PARITY not evaluated — Chromium PR mode is intentionally an")',
    'print("8-shard subset, while the cloud baseline describes all 24 shards.")',
    'sys.exit(0)',
  ];
  if (
    subset === -1 ||
    baseline === -1 ||
    subset > baseline ||
    JSON.stringify(normalizedLines(subsetBlock)) !==
      JSON.stringify(expectedSubset)
  ) {
    errors.push('Chromium subset is not excluded before full cloud parity');
  }
  return errors;
}

describe('e2e-local browser selection (#950)', () => {
  const code = stripComments(RAW);
  const changes = between(code, '  changes:', '  e2e-local:');
  const selection = between(
    changes,
    '      - name: Select browser coverage',
    '      - uses: actions/checkout@v5'
  );
  const matrix = between(code, '  e2e-local:', '  parity:');
  const aggregate = between(code, '  parity:', '__END_OF_WORKFLOW__');

  it('found real workflow code rather than comments or an empty stale path', () => {
    assert.ok(RAW.length > 20_000, `${WORKFLOW} is suspiciously small`);
    assert.ok(
      code.length < RAW.length - 5_000,
      'comment stripper removed too little'
    );
    assert.ok(selection.length > 500, 'browser selector step not found');
    assert.ok(matrix.length > 5_000, 'matrix job not found');
    assert.ok(aggregate.length > 5_000, 'aggregate job not found');
    assert.doesNotMatch(code, /Filter the matrix BEFORE runner allocation/);
  });

  it('launches a fresh run when full-e2e is added', () => {
    assert.deepStrictEqual(triggerErrors(code), []);
  });

  it('selects one browser for ordinary PRs and three for full events', () => {
    assert.deepStrictEqual(selectionErrors(changes), []);
  });

  it('keeps cross-browser running somewhere, now that merges no longer do it (#1135)', () => {
    assert.deepStrictEqual(nightlyErrors(code), []);
  });

  it('builds only the selected browser × eight slices', () => {
    assert.deepStrictEqual(matrixErrors(matrix), []);
  });

  it('makes the required aggregate consume the selected shard count and floor', () => {
    assert.deepStrictEqual(aggregateErrors(aggregate), []);
  });

  it('records timing without letting telemetry strand the required check', () => {
    const timing = between(
      aggregate,
      '      - name: Report queue and execution timing',
      '__END_OF_WORKFLOW__'
    );
    assert.ok(timing.length > 1_000, 'timing step not found');
    assert.match(
      timing,
      /if: needs\.changes\.outputs\.run == 'true' && github\.run_attempt == '1'/
    );
    assert.match(timing, /continue-on-error:\s*true/);
    assert.match(timing, /uses:\s*actions\/github-script@v8/);
    assert.match(timing, /getWorkflowRunAttempt/);
    assert.match(timing, /listJobsForWorkflowRunAttempt/);
    assert.match(timing, /changes\.started_at/);
    assert.match(timing, /run\.run_started_at/);
    assert.match(timing, /firstShardAt\s*=\s*Math\.min/);
    assert.doesNotMatch(timing, /run\.created_at/);
    assert.match(code, /^permissions:\n\s+contents: read\n\s+actions: read/m);
  });

  it('documents the 8-shard PR path for future maintainers', () => {
    const claude = fs.readFileSync(CLAUDE, 'utf8');
    assert.match(claude, /8 Chromium shards on an ordinary PR/);
    assert.match(
      claude,
      /24 shards on the nightly cron, dispatch, or a `full-e2e` PR/,
      'CLAUDE.md still says merges run 24 shards; #1135 moved that to the nightly'
    );
    assert.doesNotMatch(
      claude,
      /24 shards on push, dispatch/,
      'the pre-#1135 sentence survived — it tells the next maintainer to check a post-merge ' +
        'cross-browser run that no longer happens'
    );
  });

  it('CONTROL: selector checks reject both load-saving regressions', () => {
    const collapsed = mutate(
      changes,
      '["chromium","firefox","webkit"]',
      '["chromium"]'
    );
    assert.ok(
      selectionErrors(collapsed).length > 0,
      'collapsed full mode was accepted'
    );

    // #1135 replaced the old "chromium-only push" regression: a chromium-only push is now the
    // INTENDED behaviour. The regression that matters here is the opposite one — putting the
    // full matrix back on every merge.
    const pushIsFullAgain = mutate(
      changes,
      "github.event_name == 'schedule' ||",
      "github.event_name != 'pull_request' ||"
    );
    assert.ok(
      selectionErrors(pushIsFullAgain).length > 0,
      'the 24-shard-on-every-merge expression was accepted (#1135)'
    );

    const inverted = mutate(
      changes,
      'if [ "$E2E_FULL_BROWSERS" = "true" ]; then',
      'if [ "$E2E_FULL_BROWSERS" != "true" ]; then'
    );
    assert.ok(
      selectionErrors(inverted).length > 0,
      'inverted full/ordinary branches were accepted'
    );

    const missingOutput = mutate(
      changes,
      '            echo "browsers=$browsers"\n',
      ''
    );
    assert.ok(
      selectionErrors(missingOutput).length > 0,
      'selector with an un-emitted browser plan was accepted'
    );

    const overwrittenPlan = mutate(
      changes,
      '          {\n',
      '          browsers=\'["chromium"]\'\n          expected_shards=8\n          browser_mode=chromium\n          {\n'
    );
    assert.ok(
      selectionErrors(overwrittenPlan).length > 0,
      'selector outputs overwritten after the branch were accepted'
    );
  });

  it('CONTROL: the nightly checks reject losing cross-browser entirely (#1135)', () => {
    // The failure mode this change introduced, driven rather than asserted. Each of these
    // leaves every check green while firefox and webkit stop running anywhere.
    const noCron = mutate(code, /^  schedule:\n    - cron: '[^']+'$/m, '');
    assert.ok(
      nightlyErrors(noCron).length > 0,
      'deleting the nightly cron was accepted — cross-browser would run nowhere'
    );

    const scheduleNotShortCircuited = mutate(
      code,
      '[ "${{ github.event_name }}" = "schedule" ]; then',
      '[ "${{ github.event_name }}" = "never-fires" ]; then'
    );
    assert.ok(
      nightlyErrors(scheduleNotShortCircuited).length > 0,
      'a schedule that falls into the push diff branch was accepted — the nightly would ' +
        'skip itself on most nights while the cron looks healthy'
    );
  });

  it('CONTROL: trigger check rejects losing the labeled activity', () => {
    const noLabelEvent = code.replace(
      'types: [opened, synchronize, reopened, labeled]',
      'types: [opened, synchronize, reopened]'
    );
    assert.ok(
      triggerErrors(noLabelEvent).length > 0,
      'full-e2e label without a triggering activity was accepted'
    );
  });

  it('CONTROL: matrix check rejects fixed, malformed, and extra axes', () => {
    const fixed = matrix.replace(
      '${{ fromJSON(needs.changes.outputs.browsers) }}',
      '[chromium, firefox, webkit]'
    );
    assert.ok(
      matrixErrors(fixed).length > 0,
      'fixed 24-job matrix was accepted'
    );

    const malformedShard = matrix.replace(
      '{ project: gen, shard: 1/6 }',
      '{ project: gen, shard: 1/7 }'
    );
    assert.ok(
      matrixErrors(malformedShard).length > 0,
      'incorrect shard denominator was accepted'
    );

    const extraAxis = matrix.replace(
      '        slice:',
      '        duplicate: [a, b]\n        slice:'
    );
    assert.ok(
      matrixErrors(extraAxis).length > 0,
      'extra runner-multiplying matrix axis was accepted'
    );

    const quotedAxis = matrix.replace(
      '        slice:',
      '        "duplicate": [a, b]\n        slice:'
    );
    assert.ok(
      matrixErrors(quotedAxis).length > 0,
      'quoted extra matrix axis was accepted'
    );

    const multilineSlice = matrix.replace(
      '          - { project: gen, shard: 6/6 }',
      '          - { project: gen, shard: 6/6 }\n          - project: gen\n            shard: 7/7'
    );
    assert.ok(
      matrixErrors(multilineSlice).length > 0,
      'multiline ninth slice was accepted'
    );
  });

  it('CONTROL: aggregate check rejects restoring the literal 24', () => {
    const fixed = aggregate.replace(
      '${{ needs.changes.outputs.expected_shards }}',
      '24'
    );
    assert.ok(
      aggregateErrors(fixed).length > 0,
      'literal 24-shard aggregate was accepted'
    );

    const paritySubset = aggregate.replace(
      /if browser_mode != "full":([\s\S]*?)sys\.exit\(0\)/,
      'if browser_mode != "full":$1print("subset")'
    );
    assert.ok(
      aggregateErrors(paritySubset).length > 0,
      'Chromium subset falling through to cloud parity was accepted'
    );

    const hiddenExit = aggregate.replace(
      '              sys.exit(0)\n\n          on_baseline =',
      '              if False:\n                  sys.exit(0)\n\n          on_baseline ='
    );
    assert.ok(
      aggregateErrors(hiddenExit).length > 0,
      'Chromium exit hidden behind a false branch was accepted'
    );
  });
});
