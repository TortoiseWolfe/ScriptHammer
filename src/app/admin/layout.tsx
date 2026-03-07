'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AdminAuthService } from '@/services/admin';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const service = new AdminAuthService(supabase);
      const admin = await service.checkIsAdmin(user.id);
      setIsAdmin(admin);
      if (!admin) router.push('/');
    }
    if (!authLoading) {
      if (!user) router.push('/sign-in');
      else checkAdmin();
    }
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

  if (!isAdmin) return null;

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
