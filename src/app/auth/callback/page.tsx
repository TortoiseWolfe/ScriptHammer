'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { OAuthErrorBoundary } from './error-boundary';
import { createLogger } from '@/lib/logger';
import { isOAuthUser, populateOAuthProfile } from '@/lib/auth/oauth-utils';

const logger = createLogger('app:auth:callback:page');

function AuthCallbackContent() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    // Check for error in URL
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const error = params.get('error') || hashParams.get('error');
    const errorDescription =
      params.get('error_description') || hashParams.get('error_description');

    if (error) {
      setErrorDetails(
        `Error: ${error}\nDescription: ${errorDescription || 'No description'}`
      );
      logger.error('OAuth error', { error, errorDescription });
    }
  }, []);

  useEffect(() => {
    // Supabase handles state validation internally - no manual check needed

    const url = window.location.href;
    const hasCode = url.includes('code=');
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    setDebugInfo(
      `URL has code: ${hasCode}, has error: ${!!error}, isLoading: ${isLoading}, user: ${user?.email || 'null'}`
    );

    const handleAuthComplete = async () => {
      if (user) {
        // Populate OAuth profile before redirect (FR-001)
        // Non-blocking per NFR-001 - errors logged but don't block redirect
        if (isOAuthUser(user)) {
          try {
            await populateOAuthProfile(user);
          } catch (err) {
            logger.error('Failed to populate OAuth profile', { error: err });
            // Continue with redirect - non-blocking
          }
        }

        logger.info('User authenticated, redirecting to profile');
        router.push('/profile');
      } else {
        logger.debug('No user after loading, waiting 2 more seconds...');
        setTimeout(() => {
          if (!user) {
            logger.warn('Still no user, redirecting to sign-in');
            router.push('/sign-in?error=auth_callback_failed');
          }
        }, 2000);
      }
    };

    if (!isLoading && !error) {
      handleAuthComplete();
    }
  }, [user, isLoading, router]);

  if (errorDetails) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="alert alert-error mx-auto max-w-md">
          <div>
            <h3 className="font-bold">Authentication Error</h3>
            <pre className="mt-2 text-xs whitespace-pre-wrap">
              {errorDetails}
            </pre>
            <p className="mt-2 text-sm">URL: {window.location.href}</p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/sign-in')}
            className="btn btn-primary"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Completing sign in...</p>
        <p className="mt-2 text-sm text-gray-500">{debugInfo}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <OAuthErrorBoundary>
      <AuthCallbackContent />
    </OAuthErrorBoundary>
  );
}
