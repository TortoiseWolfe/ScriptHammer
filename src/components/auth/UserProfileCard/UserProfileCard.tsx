'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

  return (
    <div className={`card bg-base-200${className ? ` ${className}` : ''}`}>
      <div className="card-body">
        <div className="flex items-center gap-4">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content w-16 rounded-full">
              <span className="text-xl">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
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
