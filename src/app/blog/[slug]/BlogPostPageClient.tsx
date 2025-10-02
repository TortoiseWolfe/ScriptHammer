'use client';

import { useState } from 'react';
import Link from 'next/link';
import BlogPostViewer from '@/components/molecular/BlogPostViewer';
import SocialShareButtons from '@/components/molecular/SocialShareButtons';
import SEOAnalysisPanel from '@/components/molecular/SEOAnalysisPanel';
import SocialIcon from '@/components/atomic/SocialIcon';
import DisqusComments from '@/components/molecular/DisqusComments';
import type { BlogPost } from '@/types/blog';
import type { Author } from '@/types/author';
import type { TOCItem } from '@/types/metadata';
import type { SEOAnalysis } from '@/lib/blog/seo-analyzer';

interface BlogPostPageClientProps {
  post: BlogPost;
  author: Author | null;
  toc: TOCItem[];
  htmlContent: string;
  seoScore: number;
  seoAnalysis: SEOAnalysis;
  shareOptions: {
    title: string;
    text: string;
    url: string;
  };
  disqusShortname?: string;
}

export default function BlogPostPageClient({
  post,
  author,
  toc,
  htmlContent,
  seoScore,
  seoAnalysis,
  shareOptions,
  disqusShortname,
}: BlogPostPageClientProps) {
  const [showSeoDetails, setShowSeoDetails] = useState(false);

  return (
    <article className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      {/* Main Post Content - Now full width */}
      <BlogPostViewer
        post={post}
        toc={toc}
        htmlContent={htmlContent}
        showToc={true} // Show TOC but it's subtle
        showAuthor={false} // We'll show custom author section
        seoScore={seoScore}
        onSeoClick={() => {
          setShowSeoDetails(!showSeoDetails);
        }}
      />

      {/* SEO Details - Toggled by badge click */}
      {showSeoDetails && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowSeoDetails(false)}
          />

          <div
            className="fixed inset-0 flex items-center justify-center p-2 sm:p-4"
            onClick={() => setShowSeoDetails(false)}
          >
            <div
              className="bg-base-100 border-base-300 relative flex max-h-[85vh] w-full max-w-full flex-col rounded-lg border shadow-2xl sm:max-h-[90vh] sm:max-w-2xl lg:max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - fixed */}
              <div className="bg-base-100 border-base-300 flex items-center justify-between rounded-t-lg border-b p-3 sm:p-4">
                <h3 className="text-base font-bold sm:text-xl">
                  SEO Analysis Details
                </h3>
                <button
                  onClick={() => setShowSeoDetails(false)}
                  className="btn btn-circle btn-xs sm:btn-sm min-h-11 min-w-11"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content - scrollable */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                <SEOAnalysisPanel post={post} expanded={true} />
                <div className="mt-4 flex gap-2 sm:mt-6">
                  <Link
                    href="/blog/seo"
                    className="btn btn-ghost btn-xs sm:btn-sm min-h-11 min-w-11"
                  >
                    SEO Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Footer - Author + Share (PRP-017 T038) */}
      <div className="border-base-300 mt-6 border-t pt-4 sm:mt-8 sm:pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Author info */}
          {author && (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {author.avatar && (
                <div className="avatar">
                  <div className="h-10 w-10 overflow-hidden rounded-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={author.avatar}
                      alt={author.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Name and bio */}
              <div className="flex-1">
                <div className="font-semibold">{author.name}</div>
                {author.bio && (
                  <div className="text-base-content/60 line-clamp-1 text-sm">
                    {author.bio}
                  </div>
                )}
              </div>

              {/* Author social links - mobile-first touch targets (PRP-017 T038) */}
              {author.socialLinks && author.socialLinks.length > 0 && (
                <div className="flex items-center gap-1">
                  {author.socialLinks
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((link) => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary inline-flex min-h-11 min-w-11 items-center justify-center"
                        aria-label={`${author.name} on ${link.platform}`}
                      >
                        <SocialIcon
                          platform={link.platform}
                          className="h-5 w-5"
                        />
                      </a>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Right: Share buttons - compact */}
          <div className="flex items-center gap-2">
            <span className="text-base-content/40 border-base-300 hidden border-r pr-2 text-sm sm:inline">
              Share
            </span>
            <SocialShareButtons
              shareOptions={shareOptions}
              showLabels={false}
              size="sm"
              className="!gap-1"
            />
          </div>
        </div>
      </div>

      {/* Disqus Comments */}
      <DisqusComments
        slug={post.slug}
        title={post.title}
        url={shareOptions.url}
        shortname={disqusShortname}
      />
    </article>
  );
}
