'use client';

import React, { useState } from 'react';

export interface AvatarDisplayProps {
  /** Avatar image URL (null/undefined shows initials) */
  avatarUrl?: string | null;
  /** User's display name (for initials fallback) */
  displayName?: string | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
}

/**
 * AvatarDisplay component
 *
 * Displays user avatar image or initials fallback.
 * Features:
 * - Lazy loading for performance
 * - Automatic initials generation from name
 * - Error handling with graceful fallback
 * - Accessible alt text
 * - Multiple size variants
 *
 * @category atomic
 */
export default function AvatarDisplay({
  avatarUrl,
  displayName,
  size = 'md',
  className = '',
}: AvatarDisplayProps) {
  const [imageError, setImageError] = useState(false);

  // Generate initials from display name
  const getInitials = (name?: string | null): string => {
    if (!name) return '?';

    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0][0]?.toUpperCase() || '?';
    }

    // Take first letter of first and last word
    const firstInitial = words[0][0]?.toUpperCase() || '';
    const lastInitial = words[words.length - 1][0]?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}`;
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  const showImage = avatarUrl && !imageError;
  const initials = getInitials(displayName);

  return (
    <div className={`avatar ${className}`}>
      <div className={`${sizeClasses[size]} overflow-hidden rounded-full`}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- Avatar URLs from Supabase Storage, native img with lazy loading is appropriate
          <img
            src={avatarUrl}
            alt={`${displayName || 'User'}'s avatar`}
            loading="lazy"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="bg-primary text-primary-content flex h-full w-full items-center justify-center font-semibold"
            data-testid="default-avatar"
            aria-label={`${displayName || 'User'}'s avatar (initials: ${initials})`}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}
