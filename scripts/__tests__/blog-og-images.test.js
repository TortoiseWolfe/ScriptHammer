/**
 * Every published post must ship BOTH images, and both must exist (#655).
 *
 * TWO DIFFERENT IMAGES, AND CONFUSING THEM IS THE BUG THIS FILE WAS WRITTEN WITH.
 *
 *   `ogImage`       -> the social card. Only ever seen when someone pastes the link.
 *   `featuredImage` -> the image ON the site: BlogPostCard in the listing, and
 *                      BlogPostViewer on the post itself.
 *
 * The first version of this gate checked `ogImage` alone. `storefront-that-cannot-
 * take-money.md` was then "fixed" by adding `ogImage`, the gate went green, and the
 * post went on rendering with no image anywhere a reader would look — which is what
 * "the blog still doesn't have images" meant when it was reported. A gate pointed at
 * the field nobody sees, certifying the field everybody sees.
 *
 * `scripts/generate-blog-data.js` keeps them apart deliberately: `ogImage` lands at
 * `seo.ogImage` (:122) and `featuredImage` at `metadata.featuredImage` (:113), and
 * only the latter is read by the components. `ogImage` falls back to `featuredImage`
 * but NOT the other way round, so declaring only `ogImage` yields a post with a share
 * card and a blank page.
 *
 * Both are asserted, and both are checked for existence on disk, because a frontmatter
 * field pointing at a missing file is exactly as broken as no field — and it is the
 * likelier mistake once the field is mandatory.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const BLOG_DIR = path.join(__dirname, '..', '..', 'public', 'blog');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// CLAUDE.md in public/blog is guidance for authors, not a post.
const all = fs
  .readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md');

const frontmatter = (file) => {
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
};

const field = (fm, name) => {
  const m = fm.match(new RegExp(`^${name}:\\s*(\\S+)`, 'm'));
  return m ? m[1] : null;
};

/**
 * A post may declare `intentionallyImageless: true` to opt out — `bad-seo-example.md`
 * does, because it demonstrates what a post looks like with a bloated slug, a weak title
 * and no imagery, and requiring an image would destroy the thing it demonstrates.
 *
 * This used to be a hardcoded `Set(['bad-seo-example.md'])` here, guarded by a second
 * test asserting the name still matched a real file. Two problems with that: a rename
 * orphans it, and `rebrand.sh` now removes the template's posts in a fork (#936) — so
 * the exemption named a legitimately-absent file and failed in every fork. Declaring it
 * in the post's own frontmatter cannot be orphaned and is deleted with the post.
 */
const exempt = (file) =>
  /^intentionallyImageless:\s*true\s*$/m.test(frontmatter(file));
const posts = all.filter((f) => !exempt(f));

describe('every blog post ships with images a reader can actually see', () => {
  it('finds posts to check at all', () => {
    // A glob that silently matches nothing would make every assertion below vacuous.
    // This was `>= 10`. That number was never a vacuity guard — it was a claim about
    // how much content the blog has, which goes stale when the corpus shrinks and
    // fails in every fork, where rebrand.sh keeps one post (#936). Whether the corpus
    // is COMPLETE is a different question, answered against the independent source in
    // scripts/__tests__/blog-index-matches-disk.test.js (#938).
    assert.ok(
      posts.length > 0,
      `expected the blog to have posts, found ${posts.length}`
    );
  });

  it('an exemption is only claimed by a post that needs it', () => {
    // The staleness guard, inverted so it works file-locally. A post carrying the flag
    // while declaring a featuredImage does not need the flag: the exemption has outlived
    // its reason and should go, rather than sit there quietly excusing a post from a rule
    // it already satisfies.
    const unnecessary = all
      .filter((f) => exempt(f))
      .filter((f) => field(frontmatter(f), 'featuredImage'));
    assert.deepStrictEqual(
      unnecessary,
      [],
      `these declare intentionallyImageless but do have a featuredImage: ${unnecessary.join(', ')} — drop the flag`
    );
  });

  for (const file of posts) {
    for (const name of ['featuredImage', 'ogImage']) {
      it(`${file} declares ${name}`, () => {
        const value = field(frontmatter(file), name);
        assert.ok(
          value,
          `${file} has no ${name}.\n` +
            (name === 'featuredImage'
              ? '  featuredImage is the one a READER sees — the blog card and the post ' +
                'page both render it. Without it the post is blank on the site even ' +
                'if ogImage is set.'
              : '  ogImage is the social card, shown when the link is pasted.') +
            `\n  Put the file in public/blog-images/<slug>/featured-og.png and point ` +
            `${name} at it.`
        );
      });

      it(`${file}'s ${name} file exists on disk`, () => {
        const value = field(frontmatter(file), name);
        if (!value) return; // reported by the assertion above
        const rel = value.replace(/^\/+/, '');
        assert.ok(
          fs.existsSync(path.join(PUBLIC_DIR, rel)),
          `${file} points ${name} at public/${rel}, which does not exist`
        );
      });
    }
  }
});
