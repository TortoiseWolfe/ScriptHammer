#!/usr/bin/env node

/**
 * Blog Data Generation Script
 * Processes markdown files from /public/blog/ and generates JSON data
 */

const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const crypto = require('crypto');

const BLOG_DIR = path.join(process.cwd(), 'public', 'blog');
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'lib', 'blog');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'blog-data.json');

/**
 * Generate a stable ID for a post. The inputs must be committed metadata rather
 * than filesystem timestamps: the generated index is tracked in Git.
 */
function generateId(slug, publishedAt) {
  const hash = crypto
    .createHash('md5')
    .update(`${slug}-${publishedAt}`)
    .digest('hex');
  return `post_${hash.substring(0, 8)}`;
}

/**
 * Generate slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Calculate reading time
 */
function calculateReadingTime(content) {
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / 200); // 200 words per minute
}

/**
 * Extract excerpt from content
 */
function extractExcerpt(content, length = 200) {
  const plainText = content
    .replace(/^#{1,6}\s+.+$/gm, '') // Remove headers
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove images
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[*_~`>]/g, '') // Remove markdown syntax
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= length) return plainText;

  const excerpt = plainText.substring(0, length);
  const lastSpace = excerpt.lastIndexOf(' ');

  return lastSpace > 0
    ? excerpt.substring(0, lastSpace) + '...'
    : excerpt + '...';
}

/**
 * Normalize authored frontmatter dates to a stable JSON representation.
 * gray-matter parses unquoted YAML dates as Date objects, whose implicit string
 * representation varies with the machine timezone, so never hash or serialize
 * them without normalizing first.
 */
function normalizeFrontMatterDate(value, fieldName, filePath) {
  if (!value) {
    throw new Error(`${filePath} must define a ${fieldName} frontmatter date`);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${filePath} has an invalid ${fieldName} frontmatter date`);
  }

  return date.toISOString();
}

/**
 * Process a single markdown file
 */
async function processMarkdownFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontMatter, content: markdownContent } = matter(content);

  const fileName = path.basename(filePath, '.md');
  const title = frontMatter.title || fileName;
  const slug = frontMatter.slug || generateSlug(title);
  const publishedAt = normalizeFrontMatterDate(
    frontMatter.date,
    'date',
    filePath
  );
  const updatedAt = normalizeFrontMatterDate(
    frontMatter.updatedAt || frontMatter.date,
    frontMatter.updatedAt ? 'updatedAt' : 'date',
    filePath
  );
  const excerpt = frontMatter.excerpt || extractExcerpt(markdownContent);
  const wordCount = markdownContent.trim().split(/\s+/).length;
  const readingTime = calculateReadingTime(markdownContent);

  return {
    id: generateId(slug, publishedAt),
    slug,
    title,
    content: markdownContent,
    excerpt,
    publishedAt,
    updatedAt,
    status: frontMatter.draft ? 'draft' : 'published',
    author: {
      id: frontMatter.authorId || 'default',
      name: frontMatter.author || 'Anonymous',
      avatar: frontMatter.authorAvatar,
    },
    metadata: {
      tags: frontMatter.tags || [],
      categories: frontMatter.categories || [],
      readingTime,
      wordCount,
      showToc: frontMatter.showToc !== false,
      showAuthor: frontMatter.showAuthor !== false,
      showShareButtons: frontMatter.showShareButtons !== false,
      featured: frontMatter.featured || false,
      featuredImage: frontMatter.featuredImage || frontMatter.image,
      featuredImageAlt: frontMatter.featuredImageAlt || frontMatter.imageAlt,
    },
    seo: {
      title: frontMatter.seoTitle || frontMatter.title,
      description: frontMatter.seoDescription || excerpt,
      keywords: frontMatter.keywords || frontMatter.tags,
      ogTitle: frontMatter.ogTitle || frontMatter.title,
      ogDescription: frontMatter.ogDescription || excerpt,
      ogImage: frontMatter.ogImage || frontMatter.featuredImage,
      twitterCard: frontMatter.twitterCard || 'summary',
    },
    frontMatter, // Keep original frontmatter for reference
  };
}

/**
 * Main function to generate blog data
 */
async function generateBlogData({
  blogDir = BLOG_DIR,
  outputDir = OUTPUT_DIR,
  outputFile = OUTPUT_FILE,
} = {}) {
  console.log('🚀 Starting blog data generation...');

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Check if blog directory exists
  try {
    await fs.access(blogDir);
  } catch {
    console.log('📁 Creating blog directory...');
    await fs.mkdir(blogDir, { recursive: true });

    // Create sample post
    const samplePost = `---
title: Welcome to Our Blog
author: Admin
date: ${new Date().toISOString()}
tags:
  - welcome
  - announcement
categories:
  - news
excerpt: Welcome to our new blog! This is where we'll share our thoughts, updates, and insights.
---

# Welcome to Our Blog!

We're excited to launch our new blog. This is where we'll be sharing:

- Technical tutorials and guides
- Company news and updates
- Industry insights and trends
- Team stories and experiences

## What to Expect

We'll be posting regularly about topics that matter to our community. Whether you're a developer, designer, or just interested in what we do, you'll find something here for you.

## Stay Connected

Don't forget to subscribe to our newsletter to get the latest posts delivered to your inbox!

Happy reading! 🎉
`;

    await fs.writeFile(path.join(blogDir, 'welcome.md'), samplePost);
    console.log('📝 Created sample blog post');
  }

  // Get all markdown files (exclude documentation files like CLAUDE.md).
  // Sorting makes same-date posts deterministic even where readdir order differs.
  const files = await fs.readdir(blogDir);
  const markdownFiles = files
    .filter(
      (file) => file.endsWith('.md') && !file.match(/^[A-Z]+\.md$/) // Skip all-caps filenames (CLAUDE.md, README.md)
    )
    .sort();

  if (markdownFiles.length === 0) {
    console.log('⚠️  No markdown files found in', blogDir);
    console.log('💡 Add .md files to public/blog/ directory');
    return;
  }

  console.log(`📚 Found ${markdownFiles.length} markdown files`);

  // Process all markdown files
  const posts = [];
  for (const file of markdownFiles) {
    const filePath = path.join(blogDir, file);
    const post = await processMarkdownFile(filePath);

    posts.push(post);
    console.log(`✅ Processed: ${file}`);
  }

  // Sort posts by date (newest first), then slug as a deterministic tie-breaker.
  posts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() ||
      a.slug.localeCompare(b.slug)
  );

  // The index is committed: do not include a generation timestamp that changes
  // even when every source post is unchanged.
  const output = {
    posts,
    count: posts.length,
    tags: [...new Set(posts.flatMap((p) => p.metadata.tags))],
    categories: [...new Set(posts.flatMap((p) => p.metadata.categories))],
  };

  // Write output file
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

  console.log(`\n✨ Blog data generated successfully!`);
  console.log(`📄 Output: ${outputFile}`);
  console.log(`📊 Stats:`);
  console.log(`   - Total posts: ${posts.length}`);
  console.log(
    `   - Published: ${posts.filter((p) => p.status === 'published').length}`
  );
  console.log(
    `   - Drafts: ${posts.filter((p) => p.status === 'draft').length}`
  );
  console.log(`   - Tags: ${output.tags.length}`);
  console.log(`   - Categories: ${output.categories.length}`);

  return output;
}

// Run if called directly
if (require.main === module) {
  generateBlogData().catch((error) => {
    console.error('❌ Error generating blog data:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  generateBlogData,
  generateId,
  generateSlug,
  extractExcerpt,
  normalizeFrontMatterDate,
};
