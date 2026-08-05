import React from 'react';
import type { Metadata } from 'next';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AccountSettings from '@/components/auth/AccountSettings';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Account Settings - ScriptHammer',
  description: 'Manage your account settings and preferences',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto w-full px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {/* `flex-wrap` is load-bearing (#511): without it the h1 and the
              196px ghost link are pinned to one line, and at 320/375 the link
              runs past the viewport where the layout frame's overflow-x-clip
              hides it. Wrapping puts the link on its own line only when it
              cannot fit; nothing changes above `sm`. */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <Link href="/profile" className="sh-btn sh-btn-ghost">
              Back to Profile
            </Link>
          </div>

          <AccountSettings />

          <div className="divider" />

          <div className="flex flex-col gap-3">
            <Link
              href="/account/audit"
              className="btn btn-outline min-h-11 w-full"
            >
              View recent security activity
            </Link>
            <Link href="/payment" className="btn btn-outline min-h-11 w-full">
              View payments
            </Link>
            <Link
              href="/payment?tab=subscriptions"
              className="btn btn-outline min-h-11 w-full"
            >
              Manage subscriptions
            </Link>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
