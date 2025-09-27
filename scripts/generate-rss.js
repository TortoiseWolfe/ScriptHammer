#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const BLOG_DIR = path.join(process.cwd(), 'blog');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SITE_URL = 'https://tortoisewolfe.github.io/ScriptHammer';

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateRSSFeed() {
  console.log('📰 Generating RSS feed...');

  // Get all published blog posts
  const blogPosts = [];

  if (fs.existsSync(BLOG_DIR)) {
    const files = fs.readdirSync(BLOG_DIR);

    files
      .filter((file) => file.endsWith('.md'))
      .forEach((file) => {
        const fullPath = path.join(BLOG_DIR, file);
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const { data, content } = matter(fileContents);

        if (data.status === 'published') {
          blogPosts.push({
            title: data.title,
            description: data.excerpt,
            url: `/blog/${data.slug || file.replace('.md', '')}`,
            author: data.author || 'ScriptHammer Team',
            pubDate: new Date(data.publishDate || new Date()).toUTCString(),
            categories: data.categories || [],
            content: content.substring(0, 500) + '...', // First 500 chars
          });
        }
      });
  }

  // Sort by date (newest first)
  blogPosts.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Create RSS XML
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>ScriptHammer Blog</title>
    <description>Opinionated Next.js PWA Template with 32 themes and comprehensive tooling</description>
    <link>${SITE_URL}/blog</link>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>

${blogPosts
  .map(
    (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(post.description)}</description>
      <link>${SITE_URL}${post.url}</link>
      <guid isPermaLink="true">${SITE_URL}${post.url}</guid>
      <pubDate>${post.pubDate}</pubDate>
      <author>${escapeXml(post.author)}</author>
${post.categories.map((cat) => `      <category>${escapeXml(cat)}</category>`).join('\n')}
      <content:encoded><![CDATA[${post.content}]]></content:encoded>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`;

  // Write RSS feed to public directory
  const rssPath = path.join(PUBLIC_DIR, 'rss.xml');
  fs.writeFileSync(rssPath, rss, 'utf8');

  console.log(`✅ RSS feed generated with ${blogPosts.length} posts`);
  console.log(`   📁 Saved to: ${rssPath}`);

  // Also generate a simple JSON feed for modern readers
  const jsonFeed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'ScriptHammer Blog',
    home_page_url: `${SITE_URL}/blog`,
    feed_url: `${SITE_URL}/feed.json`,
    description: 'Opinionated Next.js PWA Template',
    items: blogPosts.map((post) => ({
      id: `${SITE_URL}${post.url}`,
      url: `${SITE_URL}${post.url}`,
      title: post.title,
      content_text: post.description,
      date_published: new Date(post.pubDate).toISOString(),
      author: {
        name: post.author,
      },
      tags: post.categories,
    })),
  };

  const jsonPath = path.join(PUBLIC_DIR, 'feed.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonFeed, null, 2), 'utf8');
  console.log(`   📁 JSON feed saved to: ${jsonPath}`);
}

// Run generator
generateRSSFeed();
