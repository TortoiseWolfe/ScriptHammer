'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AdminAuthService } from '@/services/admin';

/**
 * AdminGate
 *
 * Layered inside ProtectedRoute. Runs the admin RPC check and renders the
 * admin nav + children only for confirmed admins. The safety properties
 * below are load-bearing — see `AdminGate.test.tsx` for the regression
 * cases that pin them.
 *
 * - `wasAdmin` ref: once an admin check succeeded on this mount, a transient
 *   token-refresh flip (or any other non-redirecting auth blip) must not
 *   trigger router.push('/'). Mirrors ProtectedRoute's wasAuthenticated
 *   debounce against the same revert pattern (6b4c13a, 2c97e67, 259b38d).
 * - `cancelled` flag: the async `checkIsAdmin` resolution must not call
 *   setState after the effect cleaned up (different user signed in, or
 *   component unmounted).
 * - Dep array `[user, authLoading, router]`: a `user` change re-runs the
 *   check against the new user. Removing `user` from deps reintroduces a
 *   stale-state bug where the previous user's admin verdict persists.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const wasAdmin = useRef(false);

  useEffect(() => {
    if (isAdmin === true) wasAdmin.current = true;
  }, [isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // ProtectedRoute renders the sign-in card path
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
