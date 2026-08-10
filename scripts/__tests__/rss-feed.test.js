/**
 * RSS used to look in a nonexistent directory and print success for an empty
 * feed (#666). These assertions compare it to the exact generated index the
 * app and sitemap ship, and make the missing/empty-index paths fail loudly.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const matter = require('gray-matter');

const { generateRSSFeed, readPublishedBlogPosts } = require('../generate-rss');
const { generateSlug, extractExcerpt } = require('../generate-blog-data');
const { resolveSiteUrl } = require('../site-url');

const ROOT = path.join(__dirname, '..', '..');
const BLOG_DATA_PATH = path.join(ROOT, 'src/lib/blog/blog-data.json');
const BLOG_DIR = path.join(ROOT, 'public/blog');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scripthammer-rss-'));
}

function sourcePosts() {
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.md') && !/^[A-Z]+\.md$/.test(file))
    .map((file) => {
      const source = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
      const { data, content } = matter(source);
      // generate-blog-data publishes every non-draft file. `status: scheduled`
      // is not a runtime status in that generator, so it intentionally remains
      // in this independent source-index comparison.
      if (data.draft) return null;

      const fileName = path.basename(file, '.md');
      const title = data.title || fileName;
      const publishedAt = data.date ? new Date(data.date) : null;
      if (publishedAt && Number.isNaN(publishedAt.getTime())) {
        throw new Error(`${file} has no valid frontmatter date`);
      }

      return {
        slug: data.slug || generateSlug(title),
        title,
        excerpt: data.excerpt || extractExcerpt(content),
        content,
        publishedAt: publishedAt?.toISOString() || null,
        author: data.author || 'Anonymous',
        tags: data.tags || [],
        categories: data.categories || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

test('the generated blog index mirrors every feed-relevant source field', () => {
  const blogData = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
  const published = blogData.posts
    .filter((post) => post.status === 'published')
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      publishedAt: post.publishedAt,
      author: post.author.name,
      tags: post.metadata.tags,
      categories: post.metadata.categories,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const source = sourcePosts();

  assert.ok(
    source.length > 0,
    'expected source blog posts; a zero-item feed would otherwise look green'
  );
  const withoutPublishedAt = (post) => {
    const { publishedAt: _publishedAt, ...feedFields } = post;
    return feedFields;
  };
  assert.deepStrictEqual(
    published.map(withoutPublishedAt),
    source.map(withoutPublishedAt)
  );
  const bySlug = new Map(published.map((post) => [post.slug, post]));
  for (const post of source) {
    if (post.publishedAt) {
      assert.strictEqual(bySlug.get(post.slug).publishedAt, post.publishedAt);
    }
  }
});

test('RSS and JSON feeds mirror the published site index at its configured origin', () => {
  const outputDir = makeTempDir();
  try {
    const result = generateRSSFeed({
      blogDataPath: BLOG_DATA_PATH,
      publicDir: outputDir,
      env: { NEXT_PUBLIC_DEPLOY_URL: 'https://example.test/' },
      now: '2026-08-10T12:00:00.000Z',
    });
    const rss = fs.readFileSync(result.rssPath, 'utf8');
    const jsonFeed = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));

    assert.strictEqual(result.siteUrl, 'https://example.test');
    assert.strictEqual(result.blogPosts.length, sourcePosts().length);
    assert.strictEqual(jsonFeed.items.length, result.blogPosts.length);
    assert.strictEqual(jsonFeed.home_page_url, 'https://example.test/blog');
    assert.strictEqual(jsonFeed.feed_url, 'https://example.test/feed.json');
    const expectedUrls = result.blogPosts.map(
      (post) => `https://example.test${post.url}`
    );
    assert.deepStrictEqual(
      jsonFeed.items.map((item) => item.url),
      expectedUrls
    );
    assert.deepStrictEqual(
      jsonFeed.items.map((item) => item.id),
      expectedUrls
    );
    assert.strictEqual(
      (rss.match(/<item>/g) || []).length,
      expectedUrls.length
    );
    assert.ok(rss.includes('<link>https://example.test/blog</link>'));
    assert.ok(
      rss.includes(
        '<atom:link href="https://example.test/rss.xml" rel="self" type="application/rss+xml"/>'
      )
    );
    for (const url of expectedUrls) {
      assert.ok(rss.includes(`<link>${url}</link>`));
      assert.ok(rss.includes(`<guid isPermaLink="true">${url}</guid>`));
    }
    assert.ok(rss.includes('Stripe, PayPal &amp; GDPR'));
    assert.deepStrictEqual(
      jsonFeed.items.find(
        (item) =>
          item.url === 'https://example.test/blog/ride-the-open-source-city/'
      ).tags,
      [
        'three-js',
        'game-engine',
        'open-source',
        'react-three-fiber',
        'game-dev',
        'indie',
      ]
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('RSS safely splits CDATA terminators and JSON Feed keeps post tags', () => {
  const outputDir = makeTempDir();
  try {
    const blogDataPath = path.join(outputDir, 'blog-data.json');
    fs.writeFileSync(
      blogDataPath,
      JSON.stringify({
        posts: [
          {
            status: 'published',
            slug: 'xml-safety',
            title: 'Fish & Chips',
            excerpt: 'A safe feed fixture',
            content: 'Before ]]> after',
            publishedAt: '2026-08-10T00:00:00.000Z',
            author: { name: 'Feed Tester' },
            metadata: {
              tags: ['feed', 'xml'],
              categories: ['testing'],
            },
          },
        ],
      })
    );
    const result = generateRSSFeed({
      blogDataPath,
      publicDir: outputDir,
      env: { NEXT_PUBLIC_DEPLOY_URL: 'https://example.test' },
    });
    const rss = fs.readFileSync(result.rssPath, 'utf8');
    const jsonFeed = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));

    assert.ok(rss.includes('<title>Fish &amp; Chips</title>'));
    assert.ok(
      rss.includes(
        '<content:encoded><![CDATA[Before ]]]]><![CDATA[> after...]]></content:encoded>'
      )
    );
    assert.deepStrictEqual(jsonFeed.items[0].tags, ['feed', 'xml']);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('a missing or empty generated index fails instead of publishing an empty feed', () => {
  const outputDir = makeTempDir();
  try {
    assert.throws(
      () =>
        generateRSSFeed({
          blogDataPath: path.join(outputDir, 'missing.json'),
          publicDir: outputDir,
        }),
      /Unable to read blog data/
    );

    const emptyIndex = path.join(outputDir, 'empty.json');
    fs.writeFileSync(emptyIndex, JSON.stringify({ posts: [] }));
    assert.throws(
      () => generateRSSFeed({ blogDataPath: emptyIndex, publicDir: outputDir }),
      /No published blog posts/
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('the shared resolver preserves the GitHub Pages fallback for forks', () => {
  assert.deepStrictEqual(
    resolveSiteUrl({
      NEXT_PUBLIC_PROJECT_OWNER: 'ExampleOrg',
      NEXT_PUBLIC_PROJECT_NAME: 'ExampleSite',
    }),
    {
      url: 'https://exampleorg.github.io/ExampleSite',
      source: 'GitHub Pages default (no NEXT_PUBLIC_DEPLOY_URL set)',
    }
  );
});

test('the RSS reader exposes the same published records used by the feed', () => {
  assert.strictEqual(
    readPublishedBlogPosts(BLOG_DATA_PATH).length,
    sourcePosts().length
  );
});
