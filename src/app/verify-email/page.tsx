import React from 'react';
import EmailVerificationNotice from '@/components/auth/EmailVerificationNotice';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  // Not for the index: account/auth surfaces have nothing to rank and
  // should not be crawled (#668). No canonical — noindex is the claim.
  robots: { index: false, follow: false },
  title: 'Verify Email',
  description: 'Verify your email address',
};

export default function VerifyEmailPage() {
  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Verify Your Email
        </h1>

        <div className="sh-plate rounded-[26px] px-4 py-8 sm:px-6 md:px-8">
          <EmailVerificationNotice className="mb-6" />

          <p className="text-base-content text-center text-sm">
            Check your inbox for a verification link. Once verified, you&apos;ll
            be able to access all features.
          </p>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/profile" className="link-primary">
            Go to profile
          </Link>
        </p>
      </div>
    </main>
  );
}
