/**
 * Every published post must have an ogImage, and that image must exist (#655).
 *
 * `storefront-that-cannot-take-money.md` shipped and sat live with no `ogImage:` at
 * all — the only one of fourteen posts missing it. Nothing noticed, because nothing
 * looked. A post with no card image is invisible when shared, which is most of the
 * point of publishing it.
 *
 * Two assertions, deliberately, because either alone passes while the other fails:
 * a frontmatter field pointing at a file that does not exist is exactly as broken as
 * no field, and it is the more likely mistake once the field is mandatory.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const BLOG_DIR = path.join(__dirname, '..', '..', 'public', 'blog');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// CLAUDE.md in public/blog is guidance for authors, not a post.
const posts = fs
  .readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md');

const frontmatter = (file) => {
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
};

describe('every blog post ships with a usable share image', () => {
  it('finds posts to check at all', () => {
    // A glob that silently matches nothing would make every assertion below vacuous.
    assert.ok(
      posts.length >= 10,
      `expected the blog to have posts, found ${posts.length}`
    );
  });

  for (const file of posts) {
    it(`${file} declares an ogImage`, () => {
      const fm = frontmatter(file);
      assert.match(
        fm,
        /^ogImage:\s*\S+/m,
        `${file} has no ogImage. Add one and put the image in ` +
          `public/blog-images/<slug>/featured-og.png — a post with no card is ` +
          `invisible when shared, which is how the storefront post went out.`
      );
    });

    it(`${file}'s ogImage file exists on disk`, () => {
      const fm = frontmatter(file);
      const m = fm.match(/^ogImage:\s*(\S+)/m);
      if (!m) return; // the assertion above already reported this
      const rel = m[1].replace(/^\/+/, '');
      assert.ok(
        fs.existsSync(path.join(PUBLIC_DIR, rel)),
        `${file} points at public/${rel}, which does not exist`
      );
    });
  }
});
