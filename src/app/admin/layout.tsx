'use client';

import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';
import { AdminGate } from './AdminGate';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ProtectedRoute owns the auth-debounce + redirect-to-sign-in path.
  // AdminGate layers the admin RPC check on top, with its own wasAdmin ref
  // so transient token-refresh flips don't kick admins back to '/'.
  return (
    <ProtectedRoute>
      <AdminGate>{children}</AdminGate>
    </ProtectedRoute>
  );
}
