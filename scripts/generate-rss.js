#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { resolveSiteUrl, assertValidSiteUrl } = require('./site-url');

const DEFAULT_BLOG_DATA_PATH = path.join(
  process.cwd(),
  'src',
  'lib',
  'blog',
  'blog-data.json'
);
const DEFAULT_PUBLIC_DIR = path.join(process.cwd(), 'public');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCdata(value) {
  return String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
}

/**
 * The site, sitemap, and feed all consume this committed generated index.
 * Reading raw Markdown here made RSS use different publication semantics and
 * silently emit no items when it looked in a directory that does not exist.
 */
function readPublishedBlogPosts(blogDataPath) {
  let blogData;
  try {
    blogData = JSON.parse(fs.readFileSync(blogDataPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read blog data at ${blogDataPath}: ${error.message}`
    );
  }

  if (!Array.isArray(blogData.posts)) {
    throw new Error(`Blog data at ${blogDataPath} has no posts array`);
  }

  const posts = blogData.posts
    .filter((post) => post.status === 'published')
    .map((post) => {
      if (!post.slug) {
        throw new Error(`Published blog post has no slug in ${blogDataPath}`);
      }

      const publishedAt = new Date(post.publishedAt);
      if (Number.isNaN(publishedAt.getTime())) {
        throw new Error(
          `Published blog post ${post.slug} has an invalid publishedAt value`
        );
      }

      return {
        title: post.title || post.slug,
        description: post.excerpt || '',
        url: `/blog/${encodeURIComponent(post.slug)}/`,
        author: post.author?.name || 'ScriptHammer Team',
        pubDate: publishedAt,
        categories: Array.isArray(post.metadata?.categories)
          ? post.metadata.categories
          : [],
        tags: Array.isArray(post.metadata?.tags) ? post.metadata.tags : [],
        content: String(post.content ?? ''),
      };
    })
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  if (posts.length === 0) {
    throw new Error(`No published blog posts found in ${blogDataPath}`);
  }

  return posts;
}

function renderRss({ blogPosts, siteUrl, buildDate }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>ScriptHammer Blog</title>
    <description>The engineering blog of ScriptHammer, a production Next.js and Supabase platform</description>
    <link>${siteUrl}/blog</link>
    <language>en-US</language>
    <lastBuildDate>${buildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>

${blogPosts
  .map(
    (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(post.description)}</description>
      <link>${siteUrl}${post.url}</link>
      <guid isPermaLink="true">${siteUrl}${post.url}</guid>
      <pubDate>${post.pubDate.toUTCString()}</pubDate>
      <author>${escapeXml(post.author)}</author>
${post.categories
  .map((category) => `      <category>${escapeXml(category)}</category>`)
  .join('\n')}
      <content:encoded><![CDATA[${escapeCdata(post.content.substring(0, 500))}...]]></content:encoded>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`;
}

function generateRSSFeed({
  blogDataPath = DEFAULT_BLOG_DATA_PATH,
  publicDir = DEFAULT_PUBLIC_DIR,
  env = process.env,
  now = new Date(),
} = {}) {
  const resolved = resolveSiteUrl(env);
  assertValidSiteUrl(resolved.url);

  const buildDate = new Date(now);
  if (Number.isNaN(buildDate.getTime())) {
    throw new Error(`RSS build date is invalid: ${now}`);
  }

  const blogPosts = readPublishedBlogPosts(blogDataPath);
  const rss = renderRss({
    blogPosts,
    siteUrl: resolved.url,
    buildDate,
  });
  const jsonFeed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'ScriptHammer Blog',
    home_page_url: `${resolved.url}/blog`,
    feed_url: `${resolved.url}/feed.json`,
    description:
      'The engineering blog of ScriptHammer, a production Next.js and Supabase platform',
    items: blogPosts.map((post) => ({
      id: `${resolved.url}${post.url}`,
      url: `${resolved.url}${post.url}`,
      title: post.title,
      content_text: post.description,
      date_published: post.pubDate.toISOString(),
      author: { name: post.author },
      tags: post.tags,
    })),
  };

  fs.mkdirSync(publicDir, { recursive: true });
  const rssPath = path.join(publicDir, 'rss.xml');
  const jsonPath = path.join(publicDir, 'feed.json');
  fs.writeFileSync(rssPath, rss, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonFeed, null, 2), 'utf8');

  return {
    blogPosts,
    siteUrl: resolved.url,
    rssPath,
    jsonPath,
  };
}

if (require.main === module) {
  try {
    const result = generateRSSFeed();
    console.log('📰 Generated RSS and JSON feeds');
    console.log(`   🌐 Site URL: ${result.siteUrl}`);
    console.log(`   📚 Published posts: ${result.blogPosts.length}`);
    console.log(`   📁 Saved to: ${result.rssPath}`);
    console.log(`   📁 Saved to: ${result.jsonPath}`);
  } catch (error) {
    console.error(`❌ Failed to generate RSS feed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  generateRSSFeed,
  readPublishedBlogPosts,
  renderRss,
};
