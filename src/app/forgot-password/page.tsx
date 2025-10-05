import React from 'react';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Reset your password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Reset Password
        </h1>

        <p className="mb-6 text-center text-sm opacity-70">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-sm">
          <Link href="/sign-in" className="link-primary">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
