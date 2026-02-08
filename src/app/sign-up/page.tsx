'use client';

import React, { useState, useEffect } from 'react';
import SignUpForm from '@/components/auth/SignUpForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';

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

export default function SignUpPage() {
  const [returnUrl, setReturnUrl] = useState('/profile');

  useEffect(() => {
    // Read query params client-side for static export compatibility
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    if (url && isSafeRedirectUrl(decodeURIComponent(url))) {
      setReturnUrl(url);
    }
  }, []);

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Create Account
        </h1>

        <SignUpForm
          onSuccess={() => (window.location.href = '/verify-email')}
        />

        <div className="divider my-6">OR</div>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link
            href={`/sign-in${returnUrl !== '/profile' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
            className="link-primary"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
