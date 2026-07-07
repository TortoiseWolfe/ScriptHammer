'use client';

import React, { useState } from 'react';
import type { ShareOptions } from '@/types/social';

export interface SocialShareButtonsProps {
  /** Share options with title and URL */
  shareOptions: ShareOptions;
  /** Platforms to show */
  platforms?: string[];
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Show labels */
  showLabels?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Share event handler */
  onShare?: (platform: string) => void;
}

/**
 * SocialShareButtons component - Platform-specific share buttons
 *
 * @category molecular
 */
export default function SocialShareButtons({
  shareOptions,
  platforms = ['twitter', 'linkedin', 'facebook', 'reddit', 'email'],
  size = 'md',
  showLabels = false,
  className = '',
  onShare,
}: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = (platform: string) => {
    if (platform === 'copy-link') {
      navigator.clipboard.writeText(shareOptions.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShare?.('copy-link');
      return;
    }

    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareOptions.title)}&url=${encodeURIComponent(shareOptions.url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareOptions.url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareOptions.url)}`,
      reddit: `https://reddit.com/submit?url=${encodeURIComponent(shareOptions.url)}&title=${encodeURIComponent(shareOptions.title)}`,
      email: `mailto:?subject=${encodeURIComponent(shareOptions.title)}&body=${encodeURIComponent(shareOptions.text || shareOptions.title)}%20${encodeURIComponent(shareOptions.url)}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'noopener,noreferrer');
      onShare?.(platform);
    }
  };

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  // Mobile-first touch targets (PRP-017 T038)
  const buttonSizeClasses = {
    sm: showLabels
      ? 'btn-sm min-h-11 min-w-11'
      : 'min-h-11 min-w-11 inline-flex items-center justify-center',
    md: showLabels
      ? 'min-h-11 min-w-11'
      : 'min-h-11 min-w-11 inline-flex items-center justify-center',
    lg: showLabels
      ? 'btn-lg'
      : 'min-h-11 min-w-11 inline-flex items-center justify-center',
  };

  const availablePlatforms = [...platforms];
  if (!availablePlatforms.includes('copy-link')) {
    availablePlatforms.push('copy-link');
  }

  const renderIcon = (platform: string) => {
    const iconClass = sizeClasses[size];

    switch (platform) {
      case 'twitter':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'linkedin':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        );
      case 'facebook':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        );
      case 'reddit':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
          </svg>
        );
      case 'email':
        return (
          <svg
            className={iconClass}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
      case 'copy-link':
        return copied ? (
          <svg
            className={iconClass}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className={iconClass}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getLabel = (platform: string) => {
    const labels: Record<string, string> = {
      twitter: 'X',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
      reddit: 'Reddit',
      email: 'Email',
      'copy-link': copied ? 'Copied!' : 'Copy',
    };
    return labels[platform] || platform;
  };

  return (
    <div
      className={`social-share-buttons flex flex-wrap gap-2${className ? ` ${className}` : ''}`}
    >
      {availablePlatforms.map((platform) => (
        <button
          key={platform}
          onClick={() => handleShare(platform)}
          className={`${showLabels ? 'btn' : ''} ${buttonSizeClasses[size]} hover:text-primary ${!showLabels ? 'rounded' : ''}`}
          aria-label={`Share on ${getLabel(platform)}`}
          title={getLabel(platform)}
        >
          {renderIcon(platform)}
          {showLabels && <span className="ml-2">{getLabel(platform)}</span>}
        </button>
      ))}
    </div>
  );
}
