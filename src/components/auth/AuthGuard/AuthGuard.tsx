'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface AuthGuardProps {
  /** Children to render if verified */
  children: React.ReactNode;
  /** Require email verification */
  requireVerification?: boolean;
  /** Redirect path if not verified */
  redirectTo?: string;
}

/**
 * AuthGuard component
 * Redirects unverified users
 *
 * @category molecular
 */
export default function AuthGuard({
  children,
  requireVerification = true,
  redirectTo = '/verify-email',
}: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && requireVerification && !user.email_confirmed_at) {
      router.push(redirectTo);
    }
  }, [user, isLoading, requireVerification, router, redirectTo]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (requireVerification && user && !user.email_confirmed_at) {
    return null;
  }

  return <>{children}</>;
}
