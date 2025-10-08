'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';

export interface UserProfileCardProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * UserProfileCard component
 * Display user profile information
 *
 * @category molecular
 */
export default function UserProfileCard({
  className = '',
}: UserProfileCardProps) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const avatarUrl = (user.user_metadata?.avatar_url as string) || null;
  const displayName = user.user_metadata?.username || user.email || 'User';

  return (
    <div className={`card bg-base-200${className ? ` ${className}` : ''}`}>
      <div className="card-body">
        <div className="flex items-center gap-4">
          <AvatarDisplay
            avatarUrl={avatarUrl}
            displayName={displayName}
            size="lg"
          />
          <div className="flex-1">
            <h3 className="card-title">
              {user.user_metadata?.username || 'User'}
            </h3>
            <p className="text-sm opacity-70">{user.email}</p>
            {user.user_metadata?.bio && (
              <p className="mt-2 text-sm">{user.user_metadata.bio}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
