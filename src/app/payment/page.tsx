import React from 'react';
import type { Metadata } from 'next';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PaymentHubContent from './PaymentHubContent';

export const metadata: Metadata = {
  title: 'Payments - ScriptHammer',
  description: 'Manage your payments and subscriptions',
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
 * /payment — unified payment hub (consolidates the former /payment/dashboard and
 * /account/subscriptions). Behind ProtectedRoute; a tabbed shell (Overview /
 * Subscriptions) hosting PaymentQueuePanel + PaymentHistory and the
 * SubscriptionManager, deep-linkable via ?tab=.
 */
export default function PaymentHubPage() {
  return (
    <ProtectedRoute>
      <PaymentHubContent />
    </ProtectedRoute>
  );
}
