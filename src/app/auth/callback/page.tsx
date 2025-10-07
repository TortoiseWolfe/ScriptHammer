'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { validateOAuthState } from '@/lib/auth/oauth-state';
import { OAuthErrorBoundary } from './error-boundary';

function AuthCallbackContent() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [stateValidated, setStateValidated] = useState(false);

  useEffect(() => {
    const validateState = async () => {
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
        console.error('OAuth error:', error, errorDescription);
        return;
      }

      // Validate OAuth state parameter for CSRF protection (REQ-SEC-002)
      const stateToken = params.get('state') || hashParams.get('state');

      if (stateToken) {
        const validation = await validateOAuthState(stateToken);

        if (!validation.valid) {
          const errorMessages: Record<string, string> = {
            state_not_found:
              'Invalid authentication request. State token not found.',
            state_already_used:
              'This authentication link has already been used. Please try signing in again.',
            state_expired:
              'Authentication request expired. Please try signing in again.',
            session_mismatch:
              'Security error: Session mismatch detected. This may be a CSRF attack.',
            validation_error:
              'Authentication validation failed. Please try again.',
          };

          const message = errorMessages[validation.error || 'validation_error'];

          setErrorDetails(
            `CSRF Protection: ${message}\nReason: ${validation.error}`
          );
          console.error('OAuth state validation failed:', validation.error);
          return;
        }

        console.log('OAuth state validated successfully');
        setStateValidated(true);
      } else {
        // No state token - this might be a non-OAuth callback or legacy flow
        // For new OAuth flows, state should always be present
        console.warn(
          'No state token in OAuth callback - potential security issue'
        );
        setStateValidated(true); // Allow for backward compatibility
      }
    };

    validateState();
  }, []);

  useEffect(() => {
    if (!stateValidated) {
      // Wait for state validation to complete
      return;
    }

    const url = window.location.href;
    const hasCode = url.includes('code=');
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    setDebugInfo(
      `State validated, URL has code: ${hasCode}, has error: ${!!error}, isLoading: ${isLoading}, user: ${user?.email || 'null'}`
    );

    if (!isLoading && !error) {
      if (user) {
        console.log('User authenticated, redirecting to profile');
        router.push('/profile');
      } else {
        console.log('No user after loading, waiting 2 more seconds...');
        setTimeout(() => {
          if (!user) {
            console.log('Still no user, redirecting to sign-in');
            router.push('/sign-in?error=auth_callback_failed');
          }
        }, 2000);
      }
    }
  }, [user, isLoading, router, stateValidated]);

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
