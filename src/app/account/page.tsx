import React from 'react';
import type { Metadata } from 'next';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AccountSettings from '@/components/auth/AccountSettings';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Account Settings - ScriptHammer',
  description: 'Manage your account settings and preferences',
};

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <Link href="/profile" className="btn btn-ghost min-h-11">
              Back to Profile
            </Link>
          </div>

          <AccountSettings />
        </div>
      </div>
    </ProtectedRoute>
  );
}
