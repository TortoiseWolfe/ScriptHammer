'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { getInternalUrl } from '@/config/project.config';
import { useAuth } from '@/contexts/AuthContext';
import {
  readAuthLinkParams,
  stripSessionTokens,
  type AuthLinkParams,
} from '@/lib/auth/url-session';

/**
 * Why there is no session to reset with, in words the person can act on (#1255).
 *
 * A reset link is redeemable only in the browser that requested it, and GoTrue expires the
 * flow five minutes after the request. Without this, the form rendered anyway and answered
 * "Auth session missing!" after the new password had been typed twice.
 */
function NoResetSession({ link }: { link: AuthLinkParams }) {
  const cameWithLink = Boolean(link.code || link.hasTokens || link.error);
  return (
    <div className="space-y-4 text-center">
      {cameWithLink ? (
        <p>
          This reset link can&apos;t be used here. For your security, a reset
          link only works in the browser where you requested it, and only for a
          few minutes.
        </p>
      ) : (
        <p>Open the link in your password-reset email to choose a new one.</p>
      )}
      <Link href="/forgot-password" className="btn btn-primary min-h-11">
        Request a new link
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { user, isLoading } = useAuth();
  // Read once on arrival — auth-js removes a code from the URL after redeeming it.
  const [link, setLink] = useState<AuthLinkParams | null>(null);

  useEffect(() => {
    setLink(readAuthLinkParams(window.location.href));

    // Never consumed (#1255), but a live session should not stay in the address bar. See the
    // auth callback page for why this waits for the commit and passes `null` state.
    const stripped = stripSessionTokens(window.location.href);
    if (!stripped) return;
    const timer = window.setTimeout(
      () => window.history.replaceState(null, '', stripped),
      0
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Set New Password
        </h1>

        <div className="sh-plate rounded-[26px] px-4 py-8 sm:px-6 md:px-8">
          {/* The form is the default, and stays up while auth settles: the static HTML
              carries it, and someone with a valid session must not see an error first. */}
          {link && !isLoading && !user ? (
            <NoResetSession link={link} />
          ) : (
            <ResetPasswordForm
              onSuccess={() =>
                (window.location.href = getInternalUrl('/sign-in'))
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
