import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import OrderList from '@/components/payment/OrderList';

export const metadata: Metadata = {
  title: 'Your Orders - ScriptHammer',
  description: 'See what you have ordered and where each order has got to',
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
 * /orders — what a buyer bought, and what stage it has reached (#561 T029).
 *
 * Behind `ProtectedRoute`; `OrderList` reads the caller's own rows through RLS and
 * filters on `buyer_user_id` besides, so the page means the same thing for an admin as
 * for anybody else. Follows /account/audit: a SERVER component that owns the metadata and
 * the chrome, wrapping one client organism that owns the data.
 *
 * `robots.index: false` matches every other signed-in surface. Note the repo has two
 * separate mechanisms and they already disagree — /account and /profile also appear in
 * `disallowedPaths` in scripts/generate-sitemap.js, while /checkout and /payment do not.
 * This route deliberately uses the metadata half only: touching `disallowedPaths` rewrites
 * the TRACKED public/robots.txt, and a generated artifact in a diff is its own failure.
 */
export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto w-full px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* `flex-wrap` is load-bearing — see the note in account/page.tsx (#511). */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold">Your Orders</h1>
            <Link href="/account" className="sh-btn sh-btn-ghost">
              Back to Account
            </Link>
          </div>

          <p className="text-base-content mb-6">
            Every order you have placed, newest first. Amounts shown are what
            was charged — where a package was taken on deposit, the balance is
            invoiced separately.
          </p>

          <OrderList />
        </div>
      </main>
    </ProtectedRoute>
  );
}
