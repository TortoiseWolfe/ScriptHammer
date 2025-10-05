'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
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
      console.error('OAuth error:', error, errorDescription);
    }

    const url = window.location.href;
    const hasCode = url.includes('code=');

    setDebugInfo(
      `URL has code: ${hasCode}, has error: ${!!error}, isLoading: ${isLoading}, user: ${user?.email || 'null'}`
    );
    console.log('Callback page:', {
      url,
      hasCode,
      error,
      errorDescription,
      isLoading,
      user,
    });

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
