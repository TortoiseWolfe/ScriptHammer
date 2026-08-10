/**
 * Every repo-file link the app ships must point at a file that exists (#664).
 *
 * WHY. `src/app/docs/page.tsx` renders a documentation index built out of
 * repo-relative paths, and nothing verified a single one. Rename or delete a
 * linked file and `/docs` ships a GitHub 404 with no test failure, no build
 * error and no warning — the paths are strings, and nothing connects them to
 * the files.
 *
 * This is not hypothetical here. That file's own header comment (lines 13-14)
 * records that the previous version of the page linked `PWA.md` and
 * `docs/spec-kit/`, neither of which existed. It shipped that way.
 *
 * `tests/e2e/tests/broken-links.spec.ts` does NOT cover this: it classifies any
 * `http`-prefixed href as external, and external links are only `console.log`ed
 * (lines 130-137). Its hard assertion covers internal links only. So the break
 * is invisible to the one gate that sounds like it would catch it.
 *
 * ## Scope
 *
 * Four sites, found by sweeping `src/` for `blob/main|tree/main` plus the
 * registry:
 *
 *   1. `src/app/docs/page.tsx`   — the `gh()` helper, 8 call sites
 *   2. `src/components/SetupBanner/SetupBanner.tsx` — one hardcoded blob URL
 *   3. `src/app/schedule/page.tsx` — one hardcoded tree/ URL (a directory)
 *   4. `src/lib/docs/registry.ts` — 7 markdown paths
 *
 * The registry paths are ALREADY gated, and the honest reason to include them is
 * redundancy, not a hole: `pnpm build` runs as a step inside the required
 * `Test (20.x)` job, `/docs/[slug]` prerenders all 7 entries, and rendering
 * reads the file — so a bad registry path already fails a required check. What
 * this adds there is a clear message instead of a stack trace from a static
 * export. The FIRST THREE are genuinely ungated.
 *
 * `src/lib/blog/blog-data.json` is deliberately excluded — it is generated, and
 * the GitHub URLs inside it are prose in blog posts, not app navigation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/** Files that build repo-file references, and how each spells them. */
const SOURCES = [
  { file: 'src/app/docs/page.tsx', kind: 'gh' },
  { file: 'src/components/SetupBanner/SetupBanner.tsx', kind: 'url' },
  { file: 'src/app/schedule/page.tsx', kind: 'url' },
  { file: 'src/lib/docs/registry.ts', kind: 'registry' },
];

/**
 * Extract every repo-relative path a file points at.
 *
 * Read as TEXT, not imported: these are TSX/TS modules that plain node cannot
 * load, and `gh()` interpolates a runtime config value anyway. Scanning the
 * source is also what catches a hand-edited literal, which is the failure mode.
 */
function extract({ file, kind }) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const out = [];
  if (kind === 'gh') {
    for (const m of src.matchAll(/\bgh\('([^']+)'\)/g)) {
      out.push({ file, path: m[1], anchor: null });
    }
  }
  if (kind === 'url' || kind === 'gh') {
    // Hardcoded absolute URLs into the repo, with an optional #anchor.
    for (const m of src.matchAll(
      /https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/main\/([^'"`\s)]+)/g
    )) {
      const [p, anchor] = m[1].split('#');
      out.push({ file, path: p, anchor: anchor || null });
    }
  }
  if (kind === 'registry') {
    for (const m of src.matchAll(/^\s*file:\s*'([^']+)'/gm)) {
      out.push({ file, path: m[1], anchor: null });
    }
  }
  return out;
}

/**
 * Independent count of how many references each file contains.
 *
 * NOT derived from the parse above. `scripts/__tests__/manifest-assets.test.js`
 * was written without this, silently stopped parsing one entry, and passed the
 * mutation test that was supposed to catch it. A parser that quietly matches
 * less is not a smaller gate, it is an unchecked link (#396).
 */
function rawCount({ file, kind }) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let n = 0;
  if (kind === 'gh') n += (src.match(/\bgh\('/g) || []).length;
  if (kind === 'url' || kind === 'gh')
    n += (
      src.match(
        /https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/main\//g
      ) || []
    ).length;
  if (kind === 'registry') n += (src.match(/^\s*file:\s*'/gm) || []).length;
  return n;
}

const ALL = SOURCES.flatMap(extract);
const RAW_TOTAL = SOURCES.reduce((n, s) => n + rawCount(s), 0);

/** GitHub's heading-to-anchor slug: lowercase, strip punctuation, spaces to `-`. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

describe('repo links shipped by the app', () => {
  test('every reference was parsed — no silent coverage loss', () => {
    assert.strictEqual(
      ALL.length,
      RAW_TOTAL,
      `${RAW_TOTAL} repo references exist across ${SOURCES.length} files but only ` +
        `${ALL.length} were parsed. The unparsed ones are checked by nothing below.`
    );
    // Floor, so a rewrite that zeroes BOTH counts still fails.
    assert.ok(
      ALL.length >= 15,
      `Only ${ALL.length} repo links found at all. Both counts agreeing on a low ` +
        `number is still a vacuous pass — expected at least 15 (8 gh() + 2 ` +
        `hardcoded + 7 registry).`
    );
  });

  test('every linked path exists in the repo', () => {
    const missing = ALL.filter(
      (l) => !fs.existsSync(path.join(ROOT, l.path))
    ).map((l) => `${l.path}  (linked from ${l.file})`);

    assert.deepStrictEqual(
      missing,
      [],
      `These are linked from the shipped app but do not exist. Each is a GitHub ` +
        `404 for a real visitor, and no other gate catches it:\n  ` +
        missing.join('\n  ')
    );
  });

  test('every #anchor resolves to a heading in its target', () => {
    // SetupBanner links docs/FORKING.md#supabase-setup. A renamed heading
    // silently lands the reader at the top of a long document instead of the
    // section the banner promised.
    const broken = [];
    for (const l of ALL) {
      if (!l.anchor) continue;
      const target = path.join(ROOT, l.path);
      if (!fs.existsSync(target)) continue; // reported above
      const headings = (
        fs.readFileSync(target, 'utf8').match(/^#{1,6} .+$/gm) || []
      ).map((h) => slug(h.replace(/^#{1,6} /, '')));
      if (!headings.includes(l.anchor)) {
        broken.push(`${l.path}#${l.anchor}  (linked from ${l.file})`);
      }
    }
    assert.deepStrictEqual(
      broken,
      [],
      `These anchors do not match any heading in their target file:\n  ` +
        broken.join('\n  ')
    );
  });
});
