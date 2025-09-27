import React from 'react';
import Image from 'next/image';
import type { Author } from '@/types/author';
import SocialIcon from '@/components/atomic/SocialIcon';

export interface AuthorProfileProps {
  /** Author data */
  author: Author;
  /** Show social links */
  showSocial?: boolean;
  /** Show post count */
  showStats?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AuthorProfile component - Author bio and social links
 *
 * @category molecular
 */
export default function AuthorProfile({
  author,
  showSocial = true,
  showStats = true,
  className = '',
}: AuthorProfileProps) {
  const joinedDate = new Date(author.joinedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div
      className={`author-profile card bg-base-100 shadow-lg${className ? ` ${className}` : ''}`}
    >
      <div className="card-body">
        {/* Author Header */}
        <div className="mb-4 flex items-center gap-4">
          {author.avatar && (
            <div className="avatar">
              <div className="relative h-20 w-20 overflow-hidden rounded-full">
                <Image
                  src={author.avatar}
                  alt={author.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            </div>
          )}
          <div>
            <h2 className="card-title text-2xl">{author.name}</h2>
            <p className="text-base-content/60">@{author.username}</p>
          </div>
        </div>

        {/* Bio */}
        {author.bio && (
          <p className="text-base-content/80 mb-4">{author.bio}</p>
        )}

        {/* Meta Info */}
        <div className="text-base-content/60 mb-4 flex flex-wrap gap-4 text-sm">
          {author.location && (
            <span className="flex items-center gap-1">
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
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {author.location}
            </span>
          )}
          {author.company && (
            <span className="flex items-center gap-1">
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
                  d="M21 13.255A9 9 0 0019 21H5a9 9 0 00-2-7.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M12 12h.01"
                />
              </svg>
              {author.company}
            </span>
          )}
          {author.website && (
            <a
              href={author.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary flex items-center gap-1"
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
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Website
            </a>
          )}
        </div>

        {/* Stats */}
        {showStats && (
          <div className="stats stats-vertical lg:stats-horizontal mb-4 shadow">
            <div className="stat">
              <div className="stat-title">Posts</div>
              <div className="stat-value text-primary">{author.postsCount}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Member Since</div>
              <div className="stat-value text-lg">{joinedDate}</div>
            </div>
          </div>
        )}

        {/* Social Links */}
        {showSocial && !author.hideSocial && author.socialLinks.length > 0 && (
          <div className="card-actions justify-center">
            {author.socialLinks
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-circle btn-ghost"
                  aria-label={`${author.name} on ${link.platform}`}
                  title={link.platform}
                >
                  <SocialIcon platform={link.platform} />
                </a>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
