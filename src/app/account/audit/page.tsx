import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import UserAuditTrail from '@/components/molecular/UserAuditTrail';

export const metadata: Metadata = {
  title: 'Security Activity - ScriptHammer',
  description: 'Review recent security activity on your account',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/**
 * /account/audit — the user-facing security-activity dashboard (#23, feature 005).
 * Behind ProtectedRoute; UserAuditTrail reads the caller's own audit log via RLS.
 */
export default function AccountAuditPage() {
  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Security Activity</h1>
            <Link href="/account" className="btn btn-ghost min-h-11">
              Back to Account
            </Link>
          </div>

          <UserAuditTrail />
        </div>
      </main>
    </ProtectedRoute>
  );
}
