import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { PaymentDashboardContent } from './PaymentDashboardContent';

export const metadata: Metadata = {
  title: 'Payment Dashboard - ScriptHammer',
  description: 'Review your payment activity and history',
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
 * /payment/dashboard — user-facing payment activity dashboard (#3).
 * Behind ProtectedRoute; composes the existing PaymentHistory component, which
 * reads the caller's own transactions via RLS. Mirrors the /account/audit route
 * pattern (server page + client content) and the /payment-demo not-configured
 * banner.
 */
export default function PaymentDashboardPage() {
  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Payment Dashboard</h1>
            <Link href="/account" className="btn btn-ghost min-h-11">
              Back to Account
            </Link>
          </div>

          <PaymentDashboardContent />
        </div>
      </main>
    </ProtectedRoute>
  );
}
