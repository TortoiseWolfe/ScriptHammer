import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { BlogPost } from '@/types/blog';
import { seoAnalyzer } from '@/lib/blog/seo-analyzer';
import { getProjectConfig } from '@/config/project.config';
import TagBadge from '@/components/atomic/TagBadge';

export interface BlogPostCardProps {
  /** Blog post data */
  post: BlogPost;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Show SEO score */
  showSEO?: boolean;
}

/**
 * BlogPostCard component - Preview card for blog posts
 *
 * @category molecular
 */
export default function BlogPostCard({
  post,
  className = '',
  onClick,
  showSEO = true,
}: BlogPostCardProps) {
  const readingTime = post.metadata?.readingTime || 5;
  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Draft';

  // Calculate SEO score
  const seoAnalysis = showSEO ? seoAnalyzer.analyze(post) : null;
  const seoScore = seoAnalysis?.score.overall || 0;
  const seoBadgeClass = seoAnalyzer.getScoreBadgeClass(seoScore);
  const seoLabel = seoAnalyzer.getScoreLabel(seoScore);

  // Get the base path for images
  const config = getProjectConfig();
  const basePath = config.basePath || '';

  // Fix featured image path if it starts with /
  const featuredImageSrc = post.metadata?.featuredImage
    ? post.metadata.featuredImage.startsWith('/')
      ? `${basePath}${post.metadata.featuredImage}`
      : post.metadata.featuredImage
    : null;

  // 2a (#381): the card is a raised PLATE and its thumbnail a cut WELL, so the
  // image reads as set INTO the card rather than floating on it.
  //
  // `sh-plate` also opts this card out of the legacy `[data-theme='…'] .card`
  // polish, which is specificity 0,2,0 and would otherwise out-specify the
  // utility on the two default themes (#377). That is why the depth class and
  // DaisyUI's `card` can coexist here rather than fighting.
  return (
    <article
      className={`blog-post-card card sh-plate bg-base-100 rounded-box transition-transform hover:-translate-y-0.5${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {featuredImageSrc && (
        <figure className="sh-well rounded-box relative m-3 mb-0 h-48 overflow-hidden">
          <Image
            src={featuredImageSrc}
            alt={post.metadata?.featuredImageAlt || post.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </figure>
      )}

      <div className="card-body">
        {/* SEO Score Badge */}
        {showSEO && seoAnalysis && (
          <div className="mb-2 flex items-start justify-between">
            <div className={`badge ${seoBadgeClass} badge-sm gap-1`}>
              <span className="font-bold">SEO:</span>
              <span>{seoScore}%</span>
              <span className="text-xs">({seoLabel})</span>
            </div>
            {seoAnalysis.suggestions.length > 0 && (
              <div
                className="tooltip tooltip-left"
                data-tip={seoAnalysis.suggestions[0].message}
              >
                <span className="text-warning cursor-help text-sm">
                  ⚠️ {seoAnalysis.suggestions.length} suggestion
                  {seoAnalysis.suggestions.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Explicit subordinate size (#381). Unsized, `card-title` resolved to
            38.5px here — identical to the page h1 — and a real title ran five
            lines at 390px, 39% of the card's height. A listing entry should
            not compete with the heading of the page listing it. Archivo Black
            is also ~27% wider than the face this replaced (#395), so titles
            wrap sooner than the old sizing assumed. */}
        <h2 className="card-title text-xl leading-snug">
          {/* min-h-11 is load-bearing, not decoration. Shrinking the title to
              text-xl took a SINGLE-LINE title's link box to 39px — under the
              44px tap minimum — and `blog-touch-targets.spec.ts` caught it on
              the one post with a short enough title to fit on one line.
              inline-flex pads the target back to 44px without touching the
              rendered text size. Multi-line titles simply grow past it. */}
          <Link
            href={`/blog/${post.slug}`}
            className="hover:text-primary inline-flex min-h-11 items-center"
          >
            {post.title}
          </Link>
        </h2>

        {post.excerpt && <p className="text-base-content">{post.excerpt}</p>}

        <div className="card-actions mt-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {post.metadata?.tags?.slice(0, 3).map((tag) => (
              <TagBadge key={tag} tag={tag} size="sm" variant="default" />
            ))}
            {post.metadata?.tags && post.metadata.tags.length > 3 && (
              <span className="badge badge-ghost badge-sm">
                +{post.metadata.tags.length - 3} more
              </span>
            )}
          </div>

          {/* Mono dateline (#381). Tabular metadata reads as data, not prose,
              and the fixed advance keeps dates and read-times aligned down a
              column of cards instead of jittering with the proportional face. */}
          <div className="text-base-content flex gap-3 font-mono text-xs whitespace-nowrap">
            <span>{publishedDate}</span>
            <span aria-hidden="true">·</span>
            {/* "9 min" visually, per the mock — but "9 min read" to a screen
                reader, because the bare unit is ambiguous read aloud. */}
            <span>
              {readingTime} min<span className="sr-only"> read</span>
            </span>
          </div>
        </div>

        {/* SEO Quick Stats */}
        {showSEO && seoAnalysis && (
          <div className="border-base-300 mt-4 border-t pt-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {seoAnalysis.strengths.slice(0, 2).map((strength, i) => (
                <span key={i} className="text-success flex items-center gap-1">
                  ✓ {strength}
                </span>
              ))}
              {seoAnalysis.weaknesses.slice(0, 1).map((weakness, i) => (
                <span key={i} className="text-error flex items-center gap-1">
                  ✗ {weakness}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
