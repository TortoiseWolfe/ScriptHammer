#!/usr/bin/env node
/**
 * Fail a shard whose passing tests ran ZERO assertions (#861, closing out #396).
 *
 * WHY THIS IS A SEPARATE STEP AND NOT JUST AN EXIT CODE. The shard runs Playwright under
 * `|| true` on purpose — the per-shard verdict is parsed from `results.json`, because an
 * exit code can be faked by a crash or a cancellation, and once was: `ran == 0` with
 * `|| true` produced 24 green jobs that executed nothing. So a failed status returned from
 * the reporter would be swallowed here. The reporter writes `zero-assertions.json` instead
 * and this reads it.
 *
 * WHY results.json CANNOT ANSWER THIS. Its result objects carry `annotations`,
 * `attachments`, `duration`, `errors`, `status`, `stdout` — and **no `steps`**. Assertion
 * counts are only reachable through the reporter API's step callbacks. That is the whole
 * reason the counter is a reporter rather than a post-processing script.
 *
 * WHAT A ZERO MEANS. The test passed having executed no `expect`. It is not always a
 * defect — a spec can assert through a helper that throws — but every instance found in
 * this repo was one, and the last nine were: four accessibility tests invisible to the
 * reporter (#875), two tests for features deleted or never built, one with no assertion in
 * either branch, one asserting only inside `if (failures.length > 0)`, and one guarding on
 * an error banner that no Retry control accompanies (#862). One of that family was hiding
 * a data-protection defect (#859).
 *
 * FIXING ONE means giving the test a real assertion, or a coverage floor proving it
 * measured something (`expect(measured).toBeGreaterThan(0)`) — not an allowlist entry.
 *
 * USAGE
 *   node scripts/ci/check-zero-assertions.mjs [path]   # default zero-assertions.json
 *   node scripts/ci/check-zero-assertions.mjs --selftest
 */

import { readFileSync, existsSync } from 'node:fs';

export const DEFAULT_PATH = 'zero-assertions.json';

/**
 * Decide a shard from the reporter's verdict.
 *
 * Returns `{ ok, reason }`. Deliberately strict in two directions that both once produced
 * a green tick over nothing:
 *
 *   - a MISSING file fails. It means the reporter did not run, and a gate that passes when
 *     its own input is absent is exactly the shape this exists to catch.
 *   - `observed === 0` fails. The reporter saw no tests, so the run proves nothing — the
 *     same non-vacuity rule the shard's results.json step already applies.
 */
export function decide(verdict) {
  if (verdict === null || typeof verdict !== 'object') {
    return { ok: false, reason: 'no readable verdict — the reporter did not run' };
  }
  const { mode, observed, silent } = verdict;
  if (!Array.isArray(silent) || typeof observed !== 'number') {
    return { ok: false, reason: 'malformed verdict (need numeric `observed` and array `silent`)' };
  }
  if (observed === 0) {
    return { ok: false, reason: 'the reporter observed 0 tests — this shard proves nothing' };
  }
  if (silent.length === 0) {
    return { ok: true, reason: `${observed} passing test(s), all asserted` };
  }
  if (mode !== 'block') {
    return {
      ok: true,
      reason: `${silent.length} zero-assertion test(s), but mode=${mode} — reporting only`,
    };
  }
  return {
    ok: false,
    reason: `${silent.length} of ${observed} passing test(s) ran ZERO assertions`,
  };
}

function read(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function selftest() {
  // A checker that can only reach one answer is not a checker.
  const cases = [
    [{ mode: 'block', observed: 5, silent: [] }, true, 'clean run passes'],
    [{ mode: 'block', observed: 5, silent: ['a.spec.ts:1 › x'] }, false, 'offender blocks'],
    [{ mode: 'annotate', observed: 5, silent: ['a.spec.ts:1 › x'] }, true, 'annotate only warns'],
    [{ mode: 'block', observed: 0, silent: [] }, false, 'observed nothing must fail'],
    [null, false, 'missing verdict must fail'],
    [{ mode: 'block', observed: 5 }, false, 'malformed must fail'],
  ];
  let bad = 0;
  for (const [input, want, label] of cases) {
    const got = decide(input).ok;
    if (got !== want) {
      console.error(`  selftest FAILED: ${label} — wanted ok=${want}, got ok=${got}`);
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log(`selftest ok: ${cases.length} cases, both answers reachable`);
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();

  const path = argv.find((a) => !a.startsWith('--')) ?? DEFAULT_PATH;
  const { ok, reason } = decide(read(path));
  const verdict = read(path);

  if (ok) {
    console.log(`[zero-assertions] ${reason}`);
    return;
  }

  console.log(`::error::[zero-assertions] ${reason}`);
  for (const name of verdict?.silent ?? []) console.log(`  ${name}`);
  console.log(
    '  A passing test that ran no assertion measured nothing (#396). Give it a real ' +
      'assertion, or a coverage floor proving it saw its subject — not an allowlist entry.'
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
