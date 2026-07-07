import { notFound } from 'next/navigation';
import BlogPostPageClient from './BlogPostPageClient';
import { markdownProcessor } from '@/lib/blog/markdown-processor';
import { tocGenerator } from '@/lib/blog/toc-generator';
import { seoAnalyzer } from '@/lib/blog/seo-analyzer';
import { detectedConfig } from '@/config/project-detected';
import type { BlogPost } from '@/types/blog';
import type { Author } from '@/types/author';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '@/lib/logger';

const logger = createLogger('app:blog:slug:page');

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    // Read directly from generated JSON for static export
    const jsonPath = path.join(process.cwd(), 'src/lib/blog/blog-data.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(jsonData);
    const posts = data.posts || [];

    // Find by slug
    const post = posts.find((p: any) => p.slug === slug);

    return post || null;
  } catch (error) {
    logger.error('Error fetching post', { error, slug });
    return null;
  }
}

async function getAuthor(id: string): Promise<Author | null> {
  try {
    // Import author config
    const { getAuthorByName } = await import('@/config/authors');
    const authorConfig = getAuthorByName(id);

    if (!authorConfig) {
      // Fallback to auto-detected project owner information
      return {
        id: id,
        username: detectedConfig.projectOwner.toLowerCase(),
        name: detectedConfig.projectOwner,
        email: `${detectedConfig.projectOwner.toLowerCase()}@${detectedConfig.projectHost}`,
        bio: `${detectedConfig.projectName} project owner and content creator.`,
        avatar: '/avatar-placeholder.png',
        website: detectedConfig.projectUrl,
        socialLinks: [
          {
            platform: 'github',
            url: detectedConfig.projectUrl,
            displayOrder: 0,
          },
        ],
        joinedAt: new Date().toISOString(),
        postsCount: 1,
        permissions: [],
        preferences: { publicProfile: true },
      };
    }

    // Convert from config author to blog author format
    const socialLinks: any[] = [];
    let displayOrder = 0;

    if (authorConfig.social.github) {
      socialLinks.push({
        platform: 'github',
        url: authorConfig.social.github,
        displayOrder: displayOrder++,
      });
    }
    if (authorConfig.social.twitter) {
      socialLinks.push({
        platform: 'twitter',
        url: authorConfig.social.twitter,
        displayOrder: displayOrder++,
      });
    }
    if (authorConfig.social.linkedin) {
      socialLinks.push({
        platform: 'linkedin',
        url: authorConfig.social.linkedin,
        displayOrder: displayOrder++,
      });
    }
    if (authorConfig.social.website) {
      socialLinks.push({
        platform: 'website',
        url: authorConfig.social.website,
        displayOrder: displayOrder++,
      });
    }
    if (authorConfig.social.twitch) {
      socialLinks.push({
        platform: 'twitch',
        url: authorConfig.social.twitch,
        displayOrder: displayOrder++,
      });
    }

    return {
      id: authorConfig.id,
      username: authorConfig.id,
      name: authorConfig.name,
      email:
        authorConfig.social.email ||
        `${authorConfig.id}@${detectedConfig.projectHost}`,
      bio: authorConfig.bio,
      avatar: authorConfig.avatar,
      website: authorConfig.social.website,
      socialLinks,
      joinedAt: new Date().toISOString(),
      postsCount: 1,
      permissions: [],
      preferences: {
        publicProfile: authorConfig.preferences.showSocialLinks,
        showEmail: authorConfig.preferences.showEmail,
      },
      hideSocial: !authorConfig.preferences.showSocialLinks,
    };
  } catch (error) {
    logger.error('Error fetching author', { error, authorId: id });
    return null;
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  // Process markdown content
  const processed = markdownProcessor.process(post.content);
  const toc = tocGenerator.generate(post.content);

  // Get SEO score
  const seoAnalysis = seoAnalyzer.analyze(post);
  const seoScore = seoAnalysis.score.overall;

  // Fetch author details
  const author = await getAuthor(post.author.id);

  const shareOptions = {
    title: post.title,
    text: post.excerpt || post.title,
    url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/blog/${post.slug}`,
  };

  // Generate base URL for JSON-LD
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (detectedConfig.isGitHub
      ? `https://${detectedConfig.projectOwner}.github.io/${detectedConfig.projectName}`
      : detectedConfig.projectUrl);

  // Generate image URL for JSON-LD
  let ogImagePath = post.metadata?.ogImage || post.seo?.ogImage;
  if (!ogImagePath && post.metadata?.featuredImage) {
    const featuredImagePath = post.metadata.featuredImage;
    if (featuredImagePath.endsWith('.svg')) {
      ogImagePath = featuredImagePath.replace('.svg', '-og.png');
    } else if (!featuredImagePath.includes('-og.png')) {
      const pathWithoutExt = featuredImagePath.replace(/\.[^/.]+$/, '');
      ogImagePath = `${pathWithoutExt}-og.png`;
    } else {
      ogImagePath = featuredImagePath;
    }
  }
  const imageUrl = ogImagePath
    ? ogImagePath.startsWith('http')
      ? ogImagePath
      : `${baseUrl}${ogImagePath}`
    : null;

  // Generate JSON-LD structured data
  const jsonLd = generateArticleJsonLd(post, baseUrl, imageUrl);

  // Get Disqus shortname from author config
  let disqusShortname = '';
  try {
    const { authorConfig } = require('@/config/author-generated');
    disqusShortname = authorConfig.disqus?.shortname || '';
  } catch {
    // Fallback if generated config doesn't exist
    disqusShortname = process.env.NEXT_PUBLIC_DISQUS_SHORTNAME || '';
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostPageClient
        post={post}
        author={author}
        toc={toc}
        htmlContent={processed.html}
        seoScore={seoScore}
        seoAnalysis={seoAnalysis}
        shareOptions={shareOptions}
        disqusShortname={disqusShortname}
      />
    </>
  );
}

export async function generateStaticParams() {
  try {
    const jsonPath = path.join(process.cwd(), 'src/lib/blog/blog-data.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(jsonData);
    const posts = data.posts || [];

    return posts.map((post: any) => ({
      slug: post.slug,
    }));
  } catch (error) {
    logger.error('Error generating static params', { error });
    return [];
  }
}

// Generate JSON-LD structured data for the blog post
function generateArticleJsonLd(
  post: BlogPost,
  baseUrl: string,
  imageUrl: string | null
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: imageUrl || `${baseUrl}/og-image-default.png`,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url:
        post.seo?.linkedinAuthorUrl || `${baseUrl}/authors/${post.author.id}`,
    },
    publisher: {
      '@type': 'Organization',
      name: detectedConfig.projectName,
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/apple-icon.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${post.slug}`,
    },
    keywords: post.metadata?.tags?.join(', '),
    articleSection: post.metadata?.categories?.[0] || 'Technology',
    wordCount: post.content.split(' ').length,
    ...(post.metadata?.readingTime && {
      timeRequired: `PT${Math.ceil(post.metadata.readingTime / 60)}M`,
    }),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  // Use detected config for dynamic base URL
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (detectedConfig.isGitHub
      ? `https://${detectedConfig.projectOwner}.github.io/${detectedConfig.projectName}`
      : detectedConfig.projectUrl);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  // Use explicit ogImage if provided, otherwise try to derive from featured image
  let ogImagePath = post.metadata?.ogImage || post.seo?.ogImage;

  // If no explicit OG image, try to derive from featured image
  if (!ogImagePath && post.metadata?.featuredImage) {
    const featuredImagePath = post.metadata.featuredImage;

    // If it's an SVG, look for a PNG version
    if (featuredImagePath.endsWith('.svg')) {
      ogImagePath = featuredImagePath.replace('.svg', '-og.png');
    } else if (!featuredImagePath.includes('-og.png')) {
      // For other formats, check if there's an -og.png version
      const pathWithoutExt = featuredImagePath.replace(/\.[^/.]+$/, '');
      ogImagePath = `${pathWithoutExt}-og.png`;
    } else {
      ogImagePath = featuredImagePath;
    }
  }

  // Ensure image URLs are absolute for social media
  const imageUrl = ogImagePath
    ? ogImagePath.startsWith('http')
      ? ogImagePath
      : `${baseUrl}${ogImagePath}`
    : null;

  // Calculate reading time in minutes
  const readingTimeMinutes = post.metadata?.readingTime
    ? Math.ceil(post.metadata.readingTime / 60)
    : Math.ceil(post.content.split(' ').length / 200);

  // Get primary category for Twitter label
  const primaryCategory = post.metadata?.categories?.[0] || 'Technology';

  return {
    title: post.seo?.title || post.title,
    description: post.seo?.description || post.excerpt,
    keywords: post.seo?.keywords || post.metadata?.tags,
    authors: [{ name: post.author.name }],
    creator: post.author.name,
    publisher: detectedConfig.projectName,
    alternates: {
      canonical: `${baseUrl}/blog/${post.slug}`,
    },
    other: {
      author: post.author.name,
      ...(post.metadata?.linkedinAuthorUrl && {
        'article:author': post.metadata.linkedinAuthorUrl,
      }),
      'twitter:label1': 'Reading time',
      'twitter:data1': `${readingTimeMinutes} minute${readingTimeMinutes > 1 ? 's' : ''}`,
      'twitter:label2': 'Category',
      'twitter:data2': primaryCategory,
    },
    openGraph: {
      title: post.seo?.ogTitle || post.title,
      description: post.seo?.ogDescription || post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      tags: post.metadata?.tags,
      section: post.metadata?.categories?.[0] || 'Technology',
      url: `${baseUrl}/blog/${post.slug}`,
      siteName: detectedConfig.projectName,
      locale: 'en_US',
      ...(imageUrl && {
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: post.metadata?.featuredImageAlt || post.title,
            type: 'image/png',
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seo?.ogTitle || post.title,
      description: post.seo?.ogDescription || post.excerpt,
      creator: `@${detectedConfig.projectOwner.toLowerCase()}`,
      site: `@${detectedConfig.projectName.toLowerCase()}`,
      ...(imageUrl && { images: [imageUrl] }),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}
