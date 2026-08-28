/**
 * `src/lib/blog/blog-data.json` must describe exactly the posts in `public/blog/`.
 *
 * WHY THIS EXISTS. The committed index is the single source of truth for the site, the
 * sitemap, the RSS feed and the JSON feed — `src/app/blog/[slug]/page.tsx` renders
 * `post.content` out of the JSON and never reads the markdown. And `generate:blog` is
 * deliberately NOT part of `prebuild` (see package.json), because the index is a
 * committed artifact rather than a build-time one.
 *
 * The consequence is a trap with no alarm on it: **deleting a post file changes
 * nothing.** `git rm public/blog/foo.md`, push, deploy — and foo is still live, still in
 * the sitemap, still in the feed. Editing a post is the same: the change is invisible
 * until someone remembers `pnpm generate:blog`. Nothing in CI noticed, because no test
 * compared the two sides (#938).
 *
 * It also replaces three `>= 10` post-count floors that were standing in for this
 * (`src/lib/blog/render.test.ts`, `scripts/__tests__/blog-og-images.test.js`,
 * `tests/e2e/smoke/production.smoke.spec.ts`). Those were vacuity guards — their
 * comments say so: a glob that silently matches nothing would make every assertion
 * below it pass while measuring nothing. A hardcoded 10 is a poor proxy, because it is
 * really a claim about how much content the blog has: it goes stale if the corpus
 * shrinks and is silently meaningless if it grows. It also breaks every fork, which
 * keeps exactly one post after `rebrand.sh` (#936).
 *
 * Comparing two INDEPENDENT sources is strictly stronger and needs no magic number:
 *
 *   - if the disk glob breaks, disk is empty and the index is not -> fail
 *   - if the index fails to load or changes shape, the index is empty -> fail
 *   - if a post is added or removed without regenerating -> fail
 *
 * None of those can pass vacuously, and none of them care how many posts exist.
 *
 * SCOPE, stated so nobody trusts this further than it goes: this compares the SET of
 * posts, not their contents. Editing a post without regenerating is a different drift,
 * covered by `rss-feed.test.js` ('the generated blog index mirrors every feed-relevant
 * source field').
 *
 * Do NOT "fix" a failure here by editing the expectation. Run `pnpm generate:blog` and
 * commit the resulting `blog-data.json` diff — that is the actual fix, and it is the
 * step that makes a content change reach production.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const BLOG_DIR = path.join(ROOT, 'public', 'blog');
const INDEX = path.join(ROOT, 'src', 'lib', 'blog', 'blog-data.json');

/**
 * Mirrors scripts/generate-blog-data.js exactly: `.md` only, and its ALL-CAPS exclusion
 * `/^[A-Z]+\.md$/` (CLAUDE.md is author guidance, not a post). Approximating that rule
 * is how a first version of this test wrongly counted CLAUDE.md as a sixteenth post.
 */
function postFilesOnDisk() {
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') && !/^[A-Z]+\.md$/.test(f));
}

/**
 * The slug is NOT always the filename — frontmatter may override it. Resolve it the way
 * the generator does, so the two sides are genuinely comparable.
 */
function slugOnDisk(file) {
  const src = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const fm = src.startsWith('---') ? src.slice(3, src.indexOf('\n---', 3)) : '';
  const m = fm.match(/^slug:\s*['"]?([^'"\n]+?)['"]?\s*$/m);
  return m ? m[1].trim() : file.replace(/\.md$/, '');
}

const diskSlugs = () => postFilesOnDisk().map(slugOnDisk).sort();

function indexedPosts() {
  return JSON.parse(fs.readFileSync(INDEX, 'utf8')).posts;
}

const indexSlugs = () =>
  indexedPosts()
    .map((p) => p.slug)
    .sort();

test('the blog corpus is not empty on either side', () => {
  // The vacuity guard proper, and the only floor this file needs. Everything below
  // compares two sets, and two EMPTY sets compare equal — so without this the file
  // would pass while covering nothing. Note it does not encode a corpus size: one post
  // is a legitimate corpus, which is what a fresh fork has.
  assert.ok(
    postFilesOnDisk().length > 0,
    `no post .md files found in ${BLOG_DIR}`
  );
  assert.ok(indexedPosts().length > 0, 'blog-data.json lists no posts');
});

test('the generated index describes exactly the posts on disk', () => {
  assert.deepStrictEqual(
    indexSlugs(),
    diskSlugs(),
    'blog-data.json and public/blog/ disagree. A post present on disk but missing here ' +
      'is NOT published; a post listed here but missing from disk is STILL published. ' +
      'Run `pnpm generate:blog` and commit the diff — do not edit this expectation.'
  );
});

test('the index count field agrees with the posts it lists', () => {
  // `count` is read by callers instead of posts.length, so a stale count publishes a
  // number that disagrees with the list right next to it.
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  assert.strictEqual(index.count, index.posts.length);
});
