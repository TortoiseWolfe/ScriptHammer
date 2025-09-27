'use client';

import { useState } from 'react';
import Link from 'next/link';
import BlogPostViewer from '@/components/molecular/BlogPostViewer';
import AuthorProfile from '@/components/molecular/AuthorProfile';
import SocialShareButtons from '@/components/molecular/SocialShareButtons';
import SEOAnalysisPanel from '@/components/molecular/SEOAnalysisPanel';
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
}

export default function BlogPostPageClient({
  post,
  author,
  toc,
  htmlContent,
  seoScore,
  seoAnalysis,
  shareOptions,
}: BlogPostPageClientProps) {
  const [showSeoDetails, setShowSeoDetails] = useState(false);

  console.log('BlogPostPageClient - seoScore:', seoScore);
  console.log('BlogPostPageClient - showSeoDetails:', showSeoDetails);

  return (
    <article className="container mx-auto max-w-5xl px-4 py-8">
      {/* Main Post Content - Now full width */}
      <BlogPostViewer
        post={post}
        toc={toc}
        htmlContent={htmlContent}
        showToc={true} // Show TOC but it's subtle
        showAuthor={false} // We'll show custom author section
        seoScore={seoScore}
        onSeoClick={() => {
          console.log(
            'SEO badge clicked, toggling from',
            showSeoDetails,
            'to',
            !showSeoDetails
          );
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
                  className="btn btn-circle btn-xs sm:btn-sm"
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
                    className="btn btn-ghost btn-xs sm:btn-sm"
                  >
                    SEO Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Buttons */}
      <div className="border-base-300 my-8 border-t py-8">
        <h3 className="mb-4 text-lg font-semibold">Share this post</h3>
        <SocialShareButtons
          shareOptions={shareOptions}
          showLabels={true}
          size="md"
        />
      </div>

      {/* Author Profile */}
      {author && (
        <div className="my-8">
          <h3 className="mb-4 text-lg font-semibold">About the Author</h3>
          <AuthorProfile author={author} showSocial={true} showStats={true} />
        </div>
      )}

      {/* Related Posts */}
      <div className="border-base-300 my-12 border-t py-8">
        <h3 className="mb-6 text-2xl font-semibold">Related Posts</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="card bg-base-200">
            <div className="card-body">
              <p className="text-base-content/60">
                Related posts coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
