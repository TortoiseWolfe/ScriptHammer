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
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  const platformConfig = {
    twitter: { icon: '𝕏', label: 'Twitter', color: 'hover:bg-blue-500' },
    linkedin: { icon: '💼', label: 'LinkedIn', color: 'hover:bg-blue-700' },
    facebook: { icon: 'f', label: 'Facebook', color: 'hover:bg-blue-600' },
    reddit: { icon: 'R', label: 'Reddit', color: 'hover:bg-orange-600' },
    email: { icon: '✉', label: 'Email', color: 'hover:bg-gray-600' },
    'copy-link': {
      icon: '📋',
      label: copied ? 'Copied!' : 'Copy Link',
      color: 'hover:bg-green-600',
    },
  };

  const availablePlatforms = [...platforms];
  if (!availablePlatforms.includes('copy-link')) {
    availablePlatforms.push('copy-link');
  }

  return (
    <div
      className={`social-share-buttons flex flex-wrap gap-2${className ? ` ${className}` : ''}`}
    >
      {availablePlatforms.map((platform) => {
        const config = platformConfig[platform as keyof typeof platformConfig];
        if (!config) return null;

        return (
          <button
            key={platform}
            onClick={() => handleShare(platform)}
            className={`btn ${sizeClasses[size]} ${showLabels ? '' : 'btn-circle'} btn-ghost ${config.color}`}
            aria-label={`Share on ${config.label}`}
          >
            <span className="text-xl" aria-hidden="true">
              {config.icon}
            </span>
            {showLabels && <span className="ml-2">{config.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
