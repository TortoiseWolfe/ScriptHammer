'use client';

/**
 * Protected Route HOC
 * Redirects unauthenticated users to sign-in
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options: ProtectedRouteOptions = {}
) {
  const { redirectTo = '/auth/sign-in', requireAuth = true } = options;

  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && requireAuth && !isAuthenticated) {
        router.push(redirectTo);
      }
    }, [isAuthenticated, isLoading, router]);

    // Show loading state while checking auth
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      );
    }

    // Don't render if user is not authenticated and auth is required
    if (requireAuth && !isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}

// Convenience function for protecting routes
export function useProtectedRoute(redirectTo: string = '/auth/sign-in') {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}
