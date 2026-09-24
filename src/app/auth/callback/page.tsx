'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { OAuthErrorBoundary } from './error-boundary';
import { createLogger } from '@/lib/logger';
import { isOAuthUser, populateOAuthProfile } from '@/lib/auth/oauth-utils';
import {
  readAuthLinkParams,
  stripSessionTokens,
  type AuthLinkParams,
} from '@/lib/auth/url-session';

const logger = createLogger('app:auth:callback:page');

function AuthCallbackContent() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  // What the link carried, read once on arrival: auth-js removes a code from the URL
  // once it has redeemed it, so a later read could not tell "redeemed" from "never had one".
  const [link, setLink] = useState<AuthLinkParams | null>(null);

  useEffect(() => {
    const params = readAuthLinkParams(window.location.href);
    setLink(params);

    if (params.error) {
      setErrorDetails(
        `Error: ${params.error}\nDescription: ${params.errorDescription || 'No description'}`
      );
      logger.error('OAuth error', {
        error: params.error,
        errorDescription: params.errorDescription,
      });
    }

    // A session handed over in the URL is never consumed (#1255) — but it is still a live
    // session, and should not sit in the address bar and the history. Deferred past this
    // commit's effects so Next's patched history is installed: it also updates the router's
    // own copy of the URL, which would otherwise write the tokens back on its next update.
    // `null` state is what tells the patch this is not one of Next's own calls.
    const stripped = stripSessionTokens(window.location.href);
    if (!stripped) return;
    const timer = window.setTimeout(
      () => window.history.replaceState(null, '', stripped),
      0
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!link || link.error) return;

    setDebugInfo(
      `URL has code: ${Boolean(link.code)}, isLoading: ${isLoading}, user: ${user?.email || 'null'}`
    );
    if (isLoading) return;

    if (user) {
      const complete = async () => {
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
      };
      complete();
      return;
    }

    if (link.code || link.hasTokens) {
      // A real link this browser cannot redeem: opened in another browser, after the
      // flow expired, or a resent confirmation. The page explains it; nothing to redirect.
      logger.info('Sign-in link could not be redeemed in this browser');
      return;
    }

    logger.debug('No user and no link, waiting 2 more seconds...');
    const timer = setTimeout(() => {
      logger.warn('Still no user, redirecting to sign-in');
      router.push('/sign-in?error=auth_callback_failed');
    }, 2000);
    return () => clearTimeout(timer);
  }, [link, user, isLoading, router]);

  if (errorDetails) {
    return (
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
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

  if (link && !isLoading && !user && (link.code || link.hasTokens)) {
    return (
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-bold">Sign in to continue</h1>
          <p className="mt-4">
            This link can&apos;t sign you in here. For your security, a sign-in
            link only works in the browser that asked for it, and only for a few
            minutes.
          </p>
          <p className="mt-2">
            If you were confirming your email address, it&apos;s confirmed.
          </p>
          <Link href="/sign-in" className="btn btn-primary mt-6 min-h-11">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Completing sign in...</p>
        <p className="text-base-content mt-2 text-sm">{debugInfo}</p>
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
