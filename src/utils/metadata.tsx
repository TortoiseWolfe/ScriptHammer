import type { Metadata } from 'next';
import { projectConfig } from '@/config/project.config';

export interface MetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

/**
 * Generate comprehensive metadata for social media sharing
 * Following 2025 best practices for Open Graph and Twitter Cards
 */
export function generateMetadata(options: MetadataOptions = {}): Metadata {
  const {
    title = projectConfig.projectName,
    description = projectConfig.projectDescription,
    path = '/',
    image = '/opengraph-image.png',
    type = 'website',
    publishedTime,
    modifiedTime,
    author = projectConfig.projectOwner,
    section,
    tags = [],
  } = options;

  const fullTitle =
    title === projectConfig.projectName
      ? `${title} - Modern Web Starter`
      : `${title} | ${projectConfig.projectName}`;

  const canonicalUrl = `${projectConfig.deployUrl}${path}`;

  // For Open Graph images, we need absolute URLs
  let imageUrl: string;
  if (image.startsWith('/')) {
    // For assets like opengraph-image.png, construct the full URL
    // The deployUrl already includes the project name for GitHub Pages
    imageUrl = `${projectConfig.deployUrl}${image}`;
  } else {
    // Relative paths without leading slash
    imageUrl = `${projectConfig.deployUrl}/${image}`;
  }

  const metadata: Metadata = {
    title: fullTitle,
    description,
    authors: [{ name: author }],
    generator: 'Next.js',
    applicationName: projectConfig.projectName,
    referrer: 'origin-when-cross-origin',
    keywords: ['Next.js', 'React', 'TypeScript', 'PWA', 'DaisyUI', ...tags],
    creator: author,
    publisher: projectConfig.projectOwner,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(projectConfig.deployUrl),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: projectConfig.projectName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${title} - ${description}`,
        },
      ],
      locale: 'en_US',
      type,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      creator: `@${author}`,
      site: `@${projectConfig.projectOwner}`,
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

  // Add article-specific metadata if type is article
  if (type === 'article' && metadata.openGraph) {
    metadata.openGraph = {
      ...metadata.openGraph,
      type: 'article',
      publishedTime,
      modifiedTime: modifiedTime || publishedTime,
      authors: [author],
      section,
      tags,
    };
  }

  // Add verification tags if available from environment
  if (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION) {
    metadata.verification = {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    };
  }

  return metadata;
}

/**
 * Generate JSON-LD structured data for enhanced SEO
 */
export function generateJsonLd(options: MetadataOptions = {}) {
  const {
    title = projectConfig.projectName,
    description = projectConfig.projectDescription,
    path = '/',
    type = 'website',
    publishedTime,
    modifiedTime,
    author = projectConfig.projectOwner,
  } = options;

  const baseStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: projectConfig.projectName,
    description: projectConfig.projectDescription,
    url: projectConfig.deployUrl,
    publisher: {
      '@type': 'Organization',
      name: projectConfig.projectOwner,
      url: projectConfig.projectUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${projectConfig.deployUrl}/favicon.svg`,
      },
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${projectConfig.deployUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  if (type === 'article') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      image: `${projectConfig.deployUrl}/opengraph-image.png`,
      datePublished: publishedTime,
      dateModified: modifiedTime || publishedTime,
      author: {
        '@type': 'Person',
        name: author,
        url: `${projectConfig.projectUrl}`,
      },
      publisher: baseStructuredData.publisher,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${projectConfig.deployUrl}${path}`,
      },
    };
  }

  return baseStructuredData;
}

/**
 * Generate breadcrumb JSON-LD for navigation
 */
export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${projectConfig.deployUrl}${item.url}`,
    })),
  };
}

/**
 * Helper to inject JSON-LD script tag
 */
export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
