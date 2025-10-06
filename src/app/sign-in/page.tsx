'use client';

import React, { useState, useEffect } from 'react';
import SignInForm from '@/components/auth/SignInForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';

export default function SignInPage() {
  const [returnUrl, setReturnUrl] = useState('/profile');

  useEffect(() => {
    // Read query params client-side for static export compatibility
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    if (url) {
      setReturnUrl(url);
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">Sign In</h1>

        <SignInForm
          onSuccess={() =>
            (window.location.href = decodeURIComponent(returnUrl))
          }
        />

        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="link-primary">
            Forgot password?
          </Link>
        </p>

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
    </div>
  );
}
