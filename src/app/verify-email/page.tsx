import React from 'react';
import EmailVerificationNotice from '@/components/auth/EmailVerificationNotice';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Verify your email address',
};

export default function VerifyEmailPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Verify Your Email
        </h1>

        <EmailVerificationNotice className="mb-6" />

        <p className="text-center text-sm opacity-70">
          Check your inbox for a verification link. Once verified, you&apos;ll
          be able to access all features.
        </p>

        <p className="mt-6 text-center text-sm">
          <Link href="/profile" className="link-primary">
            Go to profile
          </Link>
        </p>
      </div>
    </div>
  );
}
