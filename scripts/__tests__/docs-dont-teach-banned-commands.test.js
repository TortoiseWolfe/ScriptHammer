/**
 * Documentation must not teach the build command that breaks the dev server (#835).
 *
 * THE COMMAND. `docker compose exec <service> pnpm build` — `next dev` and `next build`
 * both own `/app/.next`, so building in the dev container wipes what the dev server is
 * serving and 500s every route until it recompiles. That is #293. CLAUDE.md documents
 * the ban and the correct form, `docker compose run --rm builder pnpm build`.
 *
 * WHY A TEST. 13 occurrences survived across five live documents, and one of them was
 * **serving in production**: `public/blog/auto-configuration-system.md` is `featured:
 * true` and renders at /blog/auto-configuration-system/, so a visitor following our own
 * onboarding post breaks their dev server — and "every route 500s" looks nothing like
 * its cause. `docs/FORKING.md` had it twice using the FORKER's service name
 * (`exec myproject`, `exec <project>`), which is why a grep for `exec scripthammer`
 * never found it, and why it reads as customised advice rather than a copied mistake.
 *
 * Meanwhile `scripts/rebrand.sh:780` already printed the correct command, citing #293.
 * The tooling was right and the prose it hands you was wrong, in the same workflow.
 *
 * This is #674's rule made mechanical: "verify every claim as you move it — a migration
 * is not a copy, it is a promotion." Nothing was comparing documentation to the
 * project's own documented constraints.
 *
 * WHAT THIS CANNOT CHECK: whether a document is otherwise accurate. It enforces one
 * named constraint, not truthfulness — stated so a green run is not over-read.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * `build` must END the command.
 *
 * `pnpm run build-storybook` writes to `storybook-static/`, never touches `.next`, and
 * is therefore NOT the hazard. A pattern ending at `build` matches it, and the naive
 * version of this check flagged `docs/CUSTOM-THEME.md:225` as a defect it is not.
 */
const BANNED = /docker compose exec \S+ pnpm (run )?build(?![\w-])/;

/** A line that states the ban is the one place that gets it right. */
const NEGATED = /\b(never|do not|don't|instead of|wrong|forbidden)\b/i;

/**
 * Historical spec records. They describe what was done at the time and are a separate
 * decision from live guidance — see #835. Excluded so the signal stays about documents
 * a reader would act on today.
 */
const ARCHIVED = /^(docs\/specs|specs|features)\//;

/**
 * Tracked files only. `out/`, `out-basepath/` and `storybook-static/` are build outputs
 * carrying copies of `public/blog`, and scanning them triples every count.
 */
function trackedMarkdown() {
  return execFileSync('git', ['ls-files', '*.md'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((f) => f && fs.existsSync(path.join(ROOT, f)));
}

function scan() {
  const hits = [];
  let scanned = 0;
  for (const rel of trackedMarkdown()) {
    scanned++;
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!BANNED.test(line)) return;
      if (NEGATED.test(line)) return;
      if (ARCHIVED.test(rel)) return;
      hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  return { scanned, hits };
}

describe('docs do not teach the #293 build command (#835)', () => {
  it('scans a real corpus', () => {
    // Non-vacuity. "No document teaches it" is trivially true of an empty file list,
    // a broken `git ls-files`, or a glob that matched nothing.
    const { scanned } = scan();
    assert.ok(
      scanned >= 50,
      `expected to scan many tracked markdown files, scanned ${scanned}`
    );
  });

  it('no live document tells a reader to build in the dev container', () => {
    const { hits } = scan();
    assert.deepEqual(
      hits,
      [],
      `these documents teach the command that wipes the dev server's .next and 500s ` +
        `every route (#293). Use \`docker compose run --rm builder pnpm build\` — the ` +
        `builder service is not renamed by rebrand.sh, so it is correct in a fork too:\n` +
        hits.map((h) => `  ${h}`).join('\n')
    );
  });

  it('the correct form is actually present somewhere', () => {
    // Guards against "fixing" this by deleting the guidance rather than correcting it.
    const good = trackedMarkdown().some((rel) =>
      /docker compose run --rm builder pnpm (run )?build/.test(
        fs.readFileSync(path.join(ROOT, rel), 'utf8')
      )
    );
    assert.ok(good, 'no document shows the correct build command at all');
  });

  it('the SERVED blog data is fixed too, not just its markdown', () => {
    // The gap this check exists for. `src/lib/blog/blog-data.json` is TRACKED and is
    // what the site renders from — scanning only `.md` would have passed green while
    // production kept serving the command. Fixing the markdown without regenerating is
    // the whole failure mode: the source reads correct and the site does not.
    const generated = path.join(ROOT, 'src', 'lib', 'blog', 'blog-data.json');
    assert.ok(fs.existsSync(generated), 'blog-data.json is missing');
    const src = fs.readFileSync(generated, 'utf8');

    const banned =
      src.match(/docker compose exec [^ "\\]+ pnpm (run )?build(?![\w-])/g) ||
      [];
    assert.deepEqual(
      banned,
      [],
      `the generated blog data still carries ${banned.length} occurrence(s) of the ` +
        `#293 command, so the live site serves it regardless of the markdown. ` +
        `Run \`pnpm run generate:blog\` after editing a post.`
    );

    // Non-vacuity: prove the file actually contains post bodies, so an empty or
    // truncated artifact cannot satisfy the assertion above.
    assert.ok(
      src.length > 10000,
      `blog-data.json is only ${src.length} bytes — too small to contain the posts`
    );
    assert.ok(
      /run --rm builder pnpm (run )?build/.test(src),
      'the corrected command is not in the generated data, so it is out of sync with the markdown'
    );
  });

  it('the detector can actually fail', () => {
    // Each control pins a case that was wrong in a real prototype of this check.
    const bad = (l) => BANNED.test(l) && !NEGATED.test(l);

    assert.equal(bad('docker compose exec scripthammer pnpm build'), true);
    assert.equal(
      bad('docker compose exec myproject pnpm run build'),
      true,
      'any service name'
    );
    assert.equal(
      bad('docker compose exec <project> pnpm run build'),
      true,
      'placeholder too'
    );

    assert.equal(
      bad('docker compose exec <project> pnpm run build-storybook'),
      false,
      'build-storybook writes to storybook-static/, not .next — not the hazard'
    );
    assert.equal(
      bad(
        'Never `docker compose exec scripthammer pnpm build` — that wipes .next (#293)'
      ),
      false,
      'the line stating the ban must not be reported as a violation'
    );
    assert.equal(
      bad('docker compose run --rm builder pnpm build'),
      false,
      'the correct form must not match'
    );

    assert.equal(
      ARCHIVED.test('docs/specs/006-font-switcher/quickstart.md'),
      true
    );
    assert.equal(ARCHIVED.test('docs/FORKING.md'), false);
  });
});
