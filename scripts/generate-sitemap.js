#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const BLOG_DIR = path.join(process.cwd(), 'blog');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SITE_URL = 'https://tortoisewolfe.github.io/ScriptHammer';

// Static pages in the application
const staticPages = [
  '',
  '/blog',
  '/blog/schedule',
  '/blog/editor',
  '/privacy',
  '/cookies',
  '/privacy-controls',
  '/components',
  '/themes',
  '/accessibility',
  '/status',
  '/contact',
  '/docs',
];

function generateSitemap() {
  console.log('🗺️ Generating sitemap...');

  // Get all blog posts
  const blogPosts = [];
  if (fs.existsSync(BLOG_DIR)) {
    const files = fs.readdirSync(BLOG_DIR);

    files
      .filter((file) => file.endsWith('.md'))
      .forEach((file) => {
        const fullPath = path.join(BLOG_DIR, file);
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const { data } = matter(fileContents);

        if (data.status === 'published') {
          blogPosts.push({
            url: `/blog/${data.slug || file.replace('.md', '')}`,
            lastmod:
              data.updatedAt || data.publishDate || new Date().toISOString(),
            priority: data.featured ? '0.9' : '0.7',
          });
        }
      });
  }

  // Create sitemap XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page}</loc>
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
</urlset>`;

  // Write sitemap to public directory
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');

  console.log(
    `✅ Sitemap generated with ${staticPages.length + blogPosts.length} URLs`
  );
  console.log(`   📁 Saved to: ${sitemapPath}`);
}

// Generate robots.txt
function generateRobotsTxt() {
  const robotsTxt = `# ScriptHammer Robots.txt
User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`;

  const robotsPath = path.join(PUBLIC_DIR, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
  console.log(`🤖 Robots.txt generated at: ${robotsPath}`);
}

// Run generators
generateSitemap();
generateRobotsTxt();
