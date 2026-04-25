'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AdminAuthService } from '@/services/admin';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  // Once an admin check has succeeded on this mount, don't let a transient
  // auth-state flip during token refresh trigger router.push('/'). Mirrors
  // ProtectedRoute's wasAuthenticated debounce.
  const wasAdmin = useRef(false);

  useEffect(() => {
    if (isAdmin === true) wasAdmin.current = true;
  }, [isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // ProtectedRoute handles unauthenticated redirect
    let cancelled = false;
    (async () => {
      const service = new AdminAuthService(supabase);
      const admin = await service.checkIsAdmin(user.id);
      if (cancelled) return;
      setIsAdmin(admin);
      if (!admin && !wasAdmin.current) router.push('/');
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </div>
    );
  }

  if (!isAdmin && !wasAdmin.current) return null;

  return (
    <div className="container mx-auto p-6">
      <nav className="tabs tabs-bordered mb-6" aria-label="Admin navigation">
        <Link href="/admin" className="tab">
          Overview
        </Link>
        <Link href="/admin/payments" className="tab">
          Payments
        </Link>
        <Link href="/admin/audit" className="tab">
          Audit Trail
        </Link>
        <Link href="/admin/users" className="tab">
          Users
        </Link>
        <Link href="/admin/messaging" className="tab">
          Messaging
        </Link>
      </nav>
      {children}
    </div>
  );
}

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
