'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import type { BlogPost } from '@/types/blog';
import type { TOCItem } from '@/types/metadata';
import BlogContent from '../BlogContent/BlogContent';
import TagBadge from '@/components/atomic/TagBadge';
import { getProjectConfig } from '@/config/project.config';

export interface BlogPostViewerProps {
  /** Blog post to display */
  post: BlogPost;
  /** Table of contents */
  toc?: TOCItem[];
  /** Rendered HTML content */
  htmlContent?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show author section */
  showAuthor?: boolean;
  /** Show table of contents */
  showToc?: boolean;
  /** SEO score to display */
  seoScore?: number;
  /** Callback when SEO badge is clicked */
  onSeoClick?: () => void;
}

/**
 * BlogPostViewer component - Full post display with TOC
 *
 * @category molecular
 */
export default function BlogPostViewer({
  post,
  toc = [],
  htmlContent,
  className = '',
  showAuthor = true,
  showToc = false,
  seoScore,
  onSeoClick,
}: BlogPostViewerProps) {
  const [activeId, setActiveId] = useState<string>('');

  // Use UTC date to avoid hydration mismatch
  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null;

  // Set up Intersection Observer to track active section
  useEffect(() => {
    if (!showToc || toc.length === 0) return;

    // Collect all heading IDs from TOC
    const getAllIds = (items: TOCItem[]): string[] => {
      let ids: string[] = [];
      items.forEach((item) => {
        ids.push(item.id);
        if (item.children && item.children.length > 0) {
          ids = ids.concat(getAllIds(item.children));
        }
      });
      return ids;
    };

    const headingIds = getAllIds(toc);
    const headingElements = headingIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (headingElements.length === 0) return;

    // Track the current active section
    const updateActiveSection = () => {
      const scrollY = window.scrollY + 100; // Account for fixed header

      // Find the current section based on scroll position
      let currentId = '';

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const element = headingElements[i];
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;

        // Check if we've scrolled past this heading
        if (scrollY >= elementTop - 10) {
          currentId = element.id;
          break;
        }
      }

      // If we haven't reached any heading yet, clear active
      if (!currentId && headingElements.length > 0) {
        const firstRect = headingElements[0].getBoundingClientRect();
        if (firstRect.top > 100) {
          // We're above all headings
          setActiveId('');
          return;
        }
      }

      // Update if changed
      if (currentId && currentId !== activeId) {
        setActiveId(currentId);
      } else if (!currentId) {
        setActiveId('');
      }
    };

    // Throttle scroll events
    let scrollTimeout: NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(updateActiveSection, 10); // More responsive
    };

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Also update on intersection for smooth transitions
    const observer = new IntersectionObserver(
      (entries) => {
        // Just trigger an update when headings come in/out of view
        updateActiveSection();
      },
      {
        rootMargin: '-20% 0px -70% 0px', // Adjusted for better detection
        threshold: [0, 1],
      }
    );

    // Observe all heading elements
    headingElements.forEach((element) => observer.observe(element));

    // Initial check
    updateActiveSection();

    // Cleanup
    return () => {
      headingElements.forEach((element) => observer.unobserve(element));
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [showToc, toc, activeId]);

  const renderTOC = (
    items: TOCItem[],
    isNested = false
  ): React.ReactElement => (
    <ul className={isNested ? 'mt-1 ml-4 space-y-1' : 'space-y-1'}>
      {items.map((item, index) => {
        // Use the original text but clean it up slightly
        let displayText = item.text
          .replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '') // Remove emojis
          .trim();

        // Truncate very long headings
        if (displayText.length > 40) {
          displayText = displayText.substring(0, 37) + '...';
        }

        const isActive = activeId === item.id;

        return (
          <li key={item.id} className="relative">
            {/* Active indicator bar */}
            {isActive && (
              <div className="bg-primary absolute top-0 left-0 h-full w-0.5" />
            )}
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById(item.id);
                if (element) {
                  const yOffset = -90; // Fixed header offset
                  const y =
                    element.getBoundingClientRect().top +
                    window.scrollY +
                    yOffset;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                  // Immediately set as active
                  setActiveId(item.id);
                }
              }}
              className={`block py-1 transition-all duration-200 ${
                isActive ? 'text-primary font-bold' : 'hover:text-primary'
              } ${
                item.level === 1
                  ? `text-sm ${!isActive ? 'font-semibold' : ''}`
                  : item.level === 2
                    ? 'text-sm'
                    : 'text-base-content/80 text-xs'
              }`}
              style={{
                paddingLeft: `${(item.level - 1) * 1 + (isActive ? 0.5 : 0)}rem`,
                transform: isActive ? 'translateX(2px)' : 'translateX(0)',
              }}
              title={item.text} // Full text on hover
            >
              {displayText}
            </a>
            {item.children &&
              item.children.length > 0 &&
              renderTOC(item.children, true)}
          </li>
        );
      })}
    </ul>
  );

  // Get the base path for images
  const config = getProjectConfig();
  const basePath = config.basePath || '';

  // Fix featured image path if it starts with /
  const featuredImageSrc = post.metadata?.featuredImage
    ? post.metadata.featuredImage.startsWith('/')
      ? `${basePath}${post.metadata.featuredImage}`
      : post.metadata.featuredImage
    : null;

  return (
    <article className={`blog-post-viewer${className ? ` ${className}` : ''}`}>
      {/* Floating controls - mobile-first positioning (PRP-017 T038) */}
      <div className="fixed top-20 right-2 z-50 space-y-3 sm:right-4">
        {/* SEO Score Badge */}
        {seoScore !== undefined && (
          <button
            onClick={onSeoClick}
            className="inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-medium shadow-md"
            style={{
              backgroundColor:
                seoScore >= 80
                  ? '#10b981'
                  : seoScore >= 60
                    ? '#f59e0b'
                    : '#ef4444',
              color: 'white',
              border: 'none',
            }}
            title="Click to view SEO details"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className="hidden sm:inline">SEO:</span> {seoScore}%
          </button>
        )}

        {/* TOC directly under SEO badge */}
        {showToc && toc.length > 0 && (
          <div className="relative">
            <details className="block">
              <summary className="text-base-content/60 hover:text-base-content/80 bg-base-100 inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-medium shadow-md transition-colors">
                <span className="inline-flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                  TOC
                </span>
              </summary>
              <nav className="bg-base-100 border-base-300 absolute top-8 right-0 z-10 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-lg border p-4 shadow-lg sm:w-80">
                {renderTOC(toc)}
              </nav>
            </details>
          </div>
        )}
      </div>

      {/* Header - Mobile-first spacing (PRP-017 T038) */}
      <header className="mb-6 sm:mb-8 md:mb-10">
        {/* Title */}
        <h1 className="mb-4 text-3xl leading-tight font-bold sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
          {post.title}
        </h1>

        <div className="text-base-content/70 flex flex-wrap gap-2 text-xs sm:gap-3 sm:text-sm md:gap-4 md:text-base">
          {publishedDate && (
            <time dateTime={post.publishedAt}>{publishedDate}</time>
          )}
          {post.metadata?.readingTime && (
            <span>{post.metadata.readingTime} min read</span>
          )}
          {post.metadata?.wordCount && (
            <span>{post.metadata.wordCount.toLocaleString()} words</span>
          )}
        </div>

        {post.metadata?.tags && post.metadata.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.metadata.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} size="sm" variant="default" />
            ))}
          </div>
        )}
      </header>

      {/* Featured Image - Mobile-first sizing (PRP-017 T038) */}
      {featuredImageSrc && (
        <figure className="mb-6 sm:mb-8 md:mb-10">
          <div className="relative h-48 w-full sm:h-64 md:h-80 lg:h-96">
            <Image
              src={featuredImageSrc}
              alt={post.metadata?.featuredImageAlt || post.title}
              fill
              className="rounded-lg object-cover shadow-lg"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              priority
            />
          </div>
          {post.metadata?.featuredImageAlt && (
            <figcaption className="text-base-content/60 mt-2 text-center text-sm">
              {post.metadata.featuredImageAlt}
            </figcaption>
          )}
        </figure>
      )}

      {/* Main Content */}
      <article className="space-y-3 text-xs leading-relaxed sm:space-y-4 sm:text-sm md:space-y-6 md:text-base lg:space-y-8 lg:text-lg">
        {htmlContent ? (
          <BlogContent htmlContent={htmlContent} />
        ) : (
          <div className="whitespace-pre-wrap">{post.content}</div>
        )}
      </article>

      {/* Author Section */}
      {showAuthor && post.author && (
        <footer className="border-base-300 mt-12 border-t pt-8">
          <div className="flex items-center gap-4">
            {post.author.avatar && (
              <div className="relative h-16 w-16">
                <Image
                  src={post.author.avatar}
                  alt={post.author.name}
                  fill
                  className="rounded-full object-cover"
                  sizes="64px"
                />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">{post.author.name}</h2>
              <p className="text-base-content/70">Author</p>
            </div>
          </div>
        </footer>
      )}
    </article>
  );
}
