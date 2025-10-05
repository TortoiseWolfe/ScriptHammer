'use client';

import React from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
          Set New Password
        </h1>

        <ResetPasswordForm
          onSuccess={() => (window.location.href = '/sign-in')}
        />
      </div>
    </div>
  );
}
