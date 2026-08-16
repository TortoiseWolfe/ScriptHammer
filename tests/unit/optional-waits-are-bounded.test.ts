import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * An "optional" wait must be bounded BELOW the test budget, or its escape hatch
 * cannot run (#757).
 *
 * THE ARITHMETIC THAT MAKES THIS A RULE. `playwright.config.ts:112` sets
 * `navigationTimeout: 60000`, deliberately, for Argon2id key derivation on the
 * messaging flows. Every project except `*-msg-iso` runs on Playwright's default
 * **30 s** test timeout. A wait with no explicit timeout inherits the 60 s
 * navigation budget — so the TEST is killed at 30 s with 30 s still on the wait's
 * clock, and a trailing `.catch(() => {})` never executes.
 *
 * It read as defensive code. It was unreachable, and it cost two merges:
 * `No horizontal overflow on /game/cod-skeleton` timed out three times at ~31.5 s
 * on branches that changed docs and one unit-test file. The WebGL route's `load`
 * occasionally exceeds the whole test budget, and the suite died on the exact line
 * written to tolerate that.
 *
 * `waitForLoadStateOrGiveUp` (tests/e2e/utils/settle.ts) is the bounded form. This
 * asserts nobody reintroduces the bare one.
 */
const E2E = join(process.cwd(), 'tests', 'e2e');

function specFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return specFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/** `waitForLoadState(...)` / `waitForNavigation(...)` with a trailing `.catch()`. */
const OPTIONAL_WAIT =
  /(waitForLoadState|waitForNavigation)\(([^)]*)\)\s*\.catch\s*\(/g;

describe('optional waits are bounded below the test budget (#757)', () => {
  const files = specFiles(E2E);

  it('found the e2e tree it is asserting about', () => {
    // Without this the sweep below passes by inspecting nothing — the shape that
    // made a sibling guard flag its own documentation and a coverage gate report
    // 100% while looking at an empty list (#396, #411).
    expect(files.length).toBeGreaterThan(30);
    expect(
      files.some((f) => f.endsWith('utils/settle.ts')),
      'expected to see the helper this rule points at'
    ).toBe(true);
  });

  it('no bare waitForLoadState/waitForNavigation followed by .catch()', () => {
    const offenders: string[] = [];

    for (const file of files) {
      // settle.ts QUOTES the broken form in its docblock to explain the rule. A
      // guard that cannot tell an instruction from a description of the bug fails
      // on its own documentation — that already happened once this week.
      if (file.endsWith(join('utils', 'settle.ts'))) continue;

      const src = readFileSync(file, 'utf8');
      for (const match of src.matchAll(OPTIONAL_WAIT)) {
        const args = match[2];
        if (/timeout\s*:/.test(args)) continue; // explicitly bounded — fine
        const line = src.slice(0, match.index).split('\n').length;
        offenders.push(
          `${file.replace(process.cwd() + '/', '')}:${line}  ${match[1]}(${args.trim()}).catch(…)`
        );
      }
    }

    expect(
      offenders,
      'these waits inherit navigationTimeout (60s), which outlives the 30s test ' +
        'budget, so their .catch() can never run. Use waitForLoadStateOrGiveUp() ' +
        'from tests/e2e/utils/settle.ts, or pass an explicit { timeout }.'
    ).toEqual([]);
  });

  it('the bounded helper exists and defaults well under the test budget', () => {
    const settle = readFileSync(join(E2E, 'utils', 'settle.ts'), 'utf8');
    const match =
      /export async function waitForLoadStateOrGiveUp\([\s\S]*?timeout = (\d+)/.exec(
        settle
      );

    expect(
      match,
      'waitForLoadStateOrGiveUp is missing or reshaped'
    ).not.toBeNull();
    // The whole point is that it expires before the test does. 30s is the default
    // budget for every project that is not *-msg-iso.
    expect(Number(match![1])).toBeLessThan(30000);
  });
});
