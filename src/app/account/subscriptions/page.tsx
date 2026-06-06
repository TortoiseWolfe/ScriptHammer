import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { SubscriptionsContent } from './SubscriptionsContent';

export const metadata: Metadata = {
  title: 'Subscriptions - ScriptHammer',
  description: 'Manage your active subscriptions',
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
 * /account/subscriptions — user-facing subscription management (#5). Behind
 * ProtectedRoute; wraps the SubscriptionManager organism (cancel/resume +
 * grace-period countdown). Mirrors the /account/audit route (server page +
 * client content) and the /payment-demo not-configured banner.
 */
export default function AccountSubscriptionsPage() {
  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Subscriptions</h1>
            <Link href="/account" className="btn btn-ghost min-h-11">
              Back to Account
            </Link>
          </div>

          <SubscriptionsContent />
        </div>
      </main>
    </ProtectedRoute>
  );
}
