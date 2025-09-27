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
  const seoColor = seoAnalyzer.getScoreColor(seoScore);
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

  return (
    <article
      className={`blog-post-card card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {featuredImageSrc && (
        <figure className="relative h-48 w-full">
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
            <div className={`badge badge-${seoColor} badge-sm gap-1`}>
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

        <h2 className="card-title">
          <Link href={`/blog/${post.slug}`} className="hover:text-primary">
            {post.title}
          </Link>
        </h2>

        {post.excerpt && <p className="text-base-content/70">{post.excerpt}</p>}

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

          <div className="text-base-content/60 flex gap-3 text-sm">
            <span>{publishedDate}</span>
            <span>{readingTime} min read</span>
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
