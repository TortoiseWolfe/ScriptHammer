import React from 'react';
import SignInForm from '@/components/auth/SignInForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">Sign In</h1>

        <SignInForm onSuccess={() => (window.location.href = '/profile')} />

        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="link-primary">
            Forgot password?
          </Link>
        </p>

        <div className="divider my-6">OR</div>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="link-primary">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
