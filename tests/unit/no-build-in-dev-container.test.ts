/**
 * No production build may run inside the dev-server container (#293, #508).
 *
 * ## The defect
 *
 * `next dev` and `next build` both own `/app/.next`. A build launched with
 * `docker compose exec <dev-service> pnpm build` writes into the directory the
 * dev server is serving from, and the two race during "Collecting page data":
 *
 *     unhandledRejection Error: Cannot find module './6048.js'
 *
 * Exit 1, no test output — indistinguishable in a log from a real build break,
 * so every occurrence costs a diagnosis and a rebuild. It happened **six times
 * across 2026-08-02 and 08-03**, three of them killing acceptance runs
 * mid-session, and one of them corrupting the dev server so quietly that `/`
 * served 200 while `/contact` served 500 — which a route-sweeping a11y probe
 * then filed as fifteen missing `<main>` landmarks (#475).
 *
 * The fix is structural: the `builder` service is the same image with its own
 * `.next` volume and no dev server inside it, so there is nothing to race.
 *
 *     docker compose run --rm builder pnpm build     # correct
 *     docker compose exec scripthammer pnpm build    # the defect
 *
 * ## Why a test and not a comment
 *
 * #293 fixed the call sites it knew about and wrote the rule into CLAUDE.md and
 * `docker-compose.yml`. **Three more survived anyway** — `e2e-live-acceptance.sh`
 * (isolated by `NEXT_DIST_DIR`, which turned out not to be enough),
 * `package.json`'s `test:pwa:build` (not isolated at all), and `rebrand.sh`,
 * which printed the offending command to every fork as step 2 of its own
 * instructions. Prose does not fail a build. This does, in `Test (20.x)`, which
 * is a required check.
 *
 * @module tests/unit/no-build-in-dev-container.test
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

/**
 * Where a build can plausibly be invoked against a running container. NOT
 * `docs/` or `.claude/` — prose that DESCRIBES this anti-pattern (including the
 * paragraphs above) is documentation of it, not an instance, and flagging it
 * would teach people to stop writing the explanation.
 */
const SCAN_DIRS = ['scripts', '.husky'];
const SCAN_FILES = ['package.json'];

/**
 * Assembled at runtime rather than written as literals.
 *
 * This file is outside SCAN_DIRS, so it cannot match itself today — but a
 * later widening of the scan would otherwise make the guard trip on its own
 * examples, and the natural repair for that is to delete the examples. Same
 * reasoning as `tailwind-literal-classes.test.ts`, where Tailwind scanning
 * `tests/` let a spec's own string literals satisfy the thing it asserted.
 */
const EXEC_RE = new RegExp(['docker', '-?\\s*compose\\s+', 'exec'].join(''));

/**
 * A NEXT build, specifically. The trailing boundary is what keeps
 * `build-storybook`, `build:analyze` and `build-inventory.py` out: Storybook
 * writes to `storybook-static/` and owns no distDir, so running it in the dev
 * container is not this defect.
 */
const BUILD_RE = new RegExp(
  ['(?:pnpm|npm|yarn)\\s+(?:run\\s+)?', 'build', '(?=[\\s\'"&|;]|$)'].join('') +
    '|' +
    ['next', '\\s+', 'build'].join('')
);

/** How a build SHOULD be invoked — used as the coverage floor below. */
const CORRECT_RE = new RegExp(
  ['docker', '\\s+compose\\s+', 'run\\s+--rm\\s+builder'].join('')
);

function filesIn(dir: string): string[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const p = join(full, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git'))
        continue;
      out.push(...filesIn(relative(ROOT, p)));
    } else if (statSync(p).size < 2_000_000) {
      out.push(p);
    }
  }
  return out;
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(): { hits: Hit[]; correct: Hit[]; filesRead: number } {
  const files = [
    ...SCAN_DIRS.flatMap(filesIn),
    ...SCAN_FILES.map((f) => join(ROOT, f)).filter(existsSync),
  ];
  const hits: Hit[] = [];
  const correct: Hit[] = [];
  let filesRead = 0;

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue; // binary / unreadable — not a place a build is invoked
    }
    filesRead++;
    content.split('\n').forEach((line, i) => {
      const rel = relative(ROOT, file);
      if (CORRECT_RE.test(line)) {
        correct.push({
          file: rel,
          line: i + 1,
          text: line.trim().slice(0, 140),
        });
      }
      // A shell comment explaining the rule is allowed to name the command.
      if (/^\s*(#|\/\/|\*)/.test(line)) return;
      // Split into COMMAND segments before matching. `test:pwa:build` chains a
      // correct `run --rm builder pnpm build` and a later `exec … sh -c` on one
      // package.json line; matching the line as a whole flags that as an
      // offence, which is a gate failing on the fixed code.
      for (const segment of line.split(/&&|\|\||;/)) {
        if (EXEC_RE.test(segment) && BUILD_RE.test(segment)) {
          hits.push({
            file: rel,
            line: i + 1,
            text: segment.trim().slice(0, 140),
          });
          break;
        }
      }
    });
  }
  return { hits, correct, filesRead };
}

describe('production builds never run in the dev container (#293, #508)', () => {
  const { hits, correct, filesRead } = scan();

  it('actually reads the scripts it claims to scan', () => {
    // A scan that reads nothing reports zero offences and reads as a pass —
    // the #411/#454 shape. A file count alone would still pass on empty
    // strings, so assert the CONTENT too: the two call sites that already do
    // this correctly must be visible to the reader.
    expect(filesRead).toBeGreaterThan(20);
    expect(
      correct.map((c) => `${c.file}:${c.line}`),
      'expected to find the existing `docker compose run --rm builder` call ' +
        'sites (validate-ci.sh, test-suite.sh, package.json). Finding none ' +
        'means this scan is not reading file contents, so its zero offences ' +
        'prove nothing.'
    ).not.toEqual([]);
    expect(correct.length).toBeGreaterThanOrEqual(2);
  });

  it('no script builds through `docker compose exec`', () => {
    expect(
      hits.map((h) => `${h.file}:${h.line}  ${h.text}`),
      'A production build inside the dev-server container clobbers the .next ' +
        'that `next dev` is serving from and corrupts both (#293, #508).\n' +
        'Use the builder service, which has its own .next volume:\n\n' +
        '    docker compose run --rm builder pnpm build\n'
    ).toEqual([]);
  });
});
