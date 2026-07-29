'use client';

import React, { useState, useEffect } from 'react';
import SignInForm from '@/components/auth/SignInForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function isSafeRedirectUrl(url: string): boolean {
  if (!url || !url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function SignInPage() {
  const router = useRouter();
  const [returnUrl, setReturnUrl] = useState('/profile');
  // Block onSuccess navigation until the returnUrl effect has run. On a
  // fast network or already-authenticated user, sign-in can resolve before
  // the URL-parsing effect finishes, sending the user to the default
  // /profile instead of the intended /messages?conversation=xyz.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read query params client-side for static export compatibility
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    if (url && isSafeRedirectUrl(decodeURIComponent(url))) {
      setReturnUrl(url);
    }
    setMounted(true);
  }, []);

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">Sign In</h1>

        <SignInForm
          onSuccess={() => {
            if (!mounted) return;
            router.push(decodeURIComponent(returnUrl));
          }}
        />

        {/* "Forgot password?" moved INTO the form, onto the Remember-Me row
            where the convention puts it (#374). It was stranded here below the
            submit button, costing a 46px line of its own. */}

        <div className="divider my-6">OR</div>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link
            href={`/sign-up${returnUrl !== '/profile' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
            className="link-primary"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
