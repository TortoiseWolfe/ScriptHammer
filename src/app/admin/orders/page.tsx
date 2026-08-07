'use client';

import React from 'react';
import AdminOrdersPanel from '@/components/organisms/AdminOrdersPanel';

/**
 * /admin/orders — what people bought, and what they sent with it (#560, T022).
 *
 * No auth handling here on purpose: src/app/admin/layout.tsx already wraps every
 * admin route in ProtectedRoute + AdminGate. Re-checking here would duplicate the
 * debounce/redirect logic that layout owns and is the source of the "admin kicked
 * back to /" flapping AdminGate's wasAdmin ref exists to prevent.
 */
export default function AdminOrdersPage() {
  return (
    <div className="container mx-auto min-w-0 px-4 py-8">
      <h1 className="mb-2 !text-2xl font-bold sm:!text-3xl">Orders</h1>
      <p className="text-base-content mb-8">
        Most recent first. Attachments open in a new tab through a short-lived
        signed link — the bucket is private, so there is no permanent URL.
      </p>
      <AdminOrdersPanel />
    </div>
  );
}
