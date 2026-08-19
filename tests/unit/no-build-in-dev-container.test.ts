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
 * ## Documentation is scanned too, but only where it INSTRUCTS (#835)
 *
 * The scan above deliberately skips `docs/`, because prose describing this
 * anti-pattern is documentation of it rather than an instance. That reasoning is
 * right and is kept — but it left a second hole: prose that TELLS a reader to run
 * the command is an instance, and 13 of them survived across five live documents.
 * One was **serving in production** (`public/blog/auto-configuration-system.md`,
 * `featured: true`), so a visitor following our own onboarding post broke their dev
 * server. `docs/FORKING.md` had it twice using the FORKER's service name
 * (`exec myproject`), which is why greps for `exec scripthammer` never found it.
 *
 * So documents are scanned with the SAME regexes and two extra exclusions: a line
 * that negates the command is a description, and archived spec directories are
 * history rather than guidance.
 *
 * @module tests/unit/no-build-in-dev-container.test
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
 *
 * THE BACKTICK IS LOAD-BEARING (#835). Markdown inline code closes with one, and
 * the occurrence that was serving in production read
 * "…after running `docker compose exec … pnpm run build` - they contain…". Without
 * a backtick in this set the documentation scan below matches fenced blocks and
 * silently misses every inline one — which is the class the live blog post was in.
 * Caught by mutation-testing the scan, not by reading it.
 */
const BUILD_RE = new RegExp(
  ['(?:pnpm|npm|yarn)\\s+(?:run\\s+)?', 'build', '(?=[\\s\'"&|;`]|$)'].join(
    ''
  ) +
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

/**
 * A line that states the rule rather than issuing it.
 *
 * `docs/superpowers/plans/2026-07-16-atlas-as-default.md` says "Never `docker compose
 * exec …`". Flagging that would delete the one place that gets it right — the same
 * repair this file's own comments warn against.
 */
const DESCRIBES_RE =
  /\b(never|do not|don't|instead of|wrong|forbidden|rather than)\b/i;

/** Historical spec records: what was done then, not what to do now. */
const DOC_ARCHIVE_RE = /^(docs\/specs|specs|features)\//;

/**
 * Tracked markdown only. `out/`, `out-basepath/` and `storybook-static/` are build
 * outputs carrying copies of `public/blog`, and scanning them triples every count.
 */
function scanDocs(): { hits: Hit[]; filesRead: number } {
  let list: string[];
  try {
    list = execFileSync('git', ['ls-files', '*.md'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32e6,
    })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return { hits: [], filesRead: 0 };
  }

  const hits: Hit[] = [];
  let filesRead = 0;
  for (const rel of list) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) continue;
    let content: string;
    try {
      content = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    filesRead++;
    if (DOC_ARCHIVE_RE.test(rel)) continue;
    content.split('\n').forEach((line, i) => {
      if (DESCRIBES_RE.test(line)) return;
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
  return { hits, filesRead };
}

describe('production builds never run in the dev container (#293, #508)', () => {
  const { hits, correct, filesRead } = scan();
  const docs = scanDocs();

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

  it('actually reads the documents it claims to scan', () => {
    // Non-vacuity. "No document instructs it" is trivially true of an empty file
    // list, a broken `git ls-files`, or a glob that matched nothing.
    expect(
      docs.filesRead,
      'the documentation scan read almost nothing, so its zero offences prove nothing'
    ).toBeGreaterThan(50);
  });

  it('no document tells a reader to build in the dev container (#835)', () => {
    expect(
      docs.hits.map((h) => `${h.file}:${h.line}  ${h.text}`),
      'These documents INSTRUCT a reader to run the command that clobbers the ' +
        '.next `next dev` is serving (#293). One of them was serving in ' +
        'production. Prose that DESCRIBES the anti-pattern is fine — negate it ' +
        '("never", "instead of") and this scan skips the line.\n\n' +
        '    docker compose run --rm builder pnpm build\n'
    ).toEqual([]);
  });

  it('the SERVED blog data is regenerated, not just its markdown (#835)', () => {
    // `src/lib/blog/blog-data.json` is TRACKED and is what the blog renders from.
    // It held all four occurrences from the post above, so fixing the markdown
    // without running `generate:blog` leaves production serving the command while
    // the source reads correct.
    const generated = join(ROOT, 'src', 'lib', 'blog', 'blog-data.json');
    if (!existsSync(generated)) return;
    const body = readFileSync(generated, 'utf8');

    expect(
      body.length,
      'blog-data.json is too small to contain the posts, so scanning it proves nothing'
    ).toBeGreaterThan(10_000);

    const offences = body
      .split(/\\n|","/)
      .filter(
        (seg) =>
          EXEC_RE.test(seg) && BUILD_RE.test(seg) && !DESCRIBES_RE.test(seg)
      );

    expect(
      offences.map((o) => o.trim().slice(0, 120)),
      'the generated blog data still carries the #293 command, so the live site ' +
        'serves it regardless of the markdown. Run `pnpm run generate:blog`.'
    ).toEqual([]);
  });
});
