#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const BLOG_DATA_PATH = path.join(process.cwd(), 'src/lib/blog/blog-data.json');
const SITE_URL = 'https://tortoisewolfe.github.io/ScriptHammer';

// Static pages in the application (public, indexable pages only)
const staticPages = [
  '', // Homepage
  '/blog',
  '/blog/schedule',
  '/blog/editor',
  '/blog/seo',
  '/blog/tags',
  '/privacy',
  '/cookies',
  '/privacy-controls',
  '/comment-policy',
  '/themes',
  '/accessibility',
  '/status',
  '/contact',
  '/docs',
  '/game',
  '/map',
  '/schedule',
];

// Auth/protected pages to disallow in robots.txt
const disallowedPaths = [
  '/sign-in/',
  '/sign-up/',
  '/forgot-password/',
  '/reset-password/',
  '/verify-email/',
  '/auth/',
  '/account/',
  '/profile/',
  '/messages/',
  '/conversations/',
  '/payment-demo/',
];

function generateSitemap() {
  console.log('🗺️ Generating sitemap...');

  // Read blog data from pre-generated JSON
  let blogData = { posts: [] };
  if (fs.existsSync(BLOG_DATA_PATH)) {
    try {
      blogData = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
      console.log(`   📖 Found ${blogData.posts?.length || 0} blog posts`);
    } catch (err) {
      console.warn('   ⚠️ Could not parse blog-data.json:', err.message);
    }
  } else {
    console.warn('   ⚠️ blog-data.json not found, skipping blog posts');
  }

  // Get published blog posts
  const blogPosts = (blogData.posts || [])
    .filter((post) => post.status === 'published')
    .map((post) => ({
      url: `/blog/${post.slug}/`, // Trailing slash!
      lastmod: post.updatedAt || post.publishedAt || new Date().toISOString(),
      priority: post.metadata?.featured ? '0.9' : '0.7',
    }));

  // Get unique tags for tag pages
  const uniqueTags = new Set();
  (blogData.posts || [])
    .filter((post) => post.status === 'published')
    .forEach((post) => {
      (post.metadata?.tags || []).forEach((tag) =>
        uniqueTags.add(tag.toLowerCase())
      );
    });

  const tagPages = Array.from(uniqueTags).map((tag) => ({
    url: `/blog/tags/${encodeURIComponent(tag)}/`, // Trailing slash!
    lastmod: new Date().toISOString(),
    priority: '0.5',
  }));

  console.log(`   🏷️ Found ${tagPages.length} unique tags`);

  // Helper to generate URL with trailing slash
  const formatUrl = (page) =>
    page === '' ? `${SITE_URL}/` : `${SITE_URL}${page}/`;

  // Create sitemap XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${formatUrl(page)}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page === '' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
${blogPosts
  .map(
    (post) => `  <url>
    <loc>${SITE_URL}${post.url}</loc>
    <lastmod>${post.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${post.priority}</priority>
  </url>`
  )
  .join('\n')}
${tagPages
  .map(
    (tag) => `  <url>
    <loc>${SITE_URL}${tag.url}</loc>
    <lastmod>${tag.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${tag.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  // Write sitemap to public directory
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');

  const totalUrls = staticPages.length + blogPosts.length + tagPages.length;
  console.log(`✅ Sitemap generated with ${totalUrls} URLs`);
  console.log(`   📁 Saved to: ${sitemapPath}`);
}

// Generate robots.txt with Disallow rules for auth pages
function generateRobotsTxt() {
  const disallowRules = disallowedPaths.map((p) => `Disallow: ${p}`).join('\n');

  const robotsTxt = `# ScriptHammer Robots.txt
User-agent: *
Allow: /

# Auth and protected pages (also have noindex meta tags)
${disallowRules}

Sitemap: ${SITE_URL}/sitemap.xml`;

  const robotsPath = path.join(PUBLIC_DIR, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
  console.log(
    `🤖 Robots.txt generated with ${disallowedPaths.length} disallow rules`
  );
}

// Run generators
generateSitemap();
generateRobotsTxt();
