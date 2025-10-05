'use client';

import React from 'react';
import SignUpForm from '@/components/auth/SignUpForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Create Account
        </h1>

        <SignUpForm onSuccess={() => (window.location.href = '/profile')} />

        <div className="divider my-6">OR</div>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/sign-in" className="link-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
