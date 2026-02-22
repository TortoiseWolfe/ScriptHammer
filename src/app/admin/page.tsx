'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminPaymentService } from '@/services/admin/admin-payment-service';
import { AdminAuditService } from '@/services/admin/admin-audit-service';
import { AdminUserService } from '@/services/admin/admin-user-service';
import { AdminMessagingService } from '@/services/admin/admin-messaging-service';
import { AdminDashboardOverview } from '@/components/organisms/AdminDashboardOverview';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { AdminAuthStats } from '@/services/admin/admin-audit-service';
import type { AdminUserStats } from '@/services/admin/admin-user-service';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [paymentStats, setPaymentStats] = useState<AdminPaymentStats | null>(
    null
  );
  const [authStats, setAuthStats] = useState<AdminAuthStats | null>(null);
  const [userStats, setUserStats] = useState<AdminUserStats | null>(null);
  const [messagingStats, setMessagingStats] =
    useState<AdminMessagingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const paymentService = new AdminPaymentService(supabase);
    const auditService = new AdminAuditService(supabase);
    const userService = new AdminUserService(supabase);
    const messagingService = new AdminMessagingService(supabase);

    try {
      await Promise.all([
        paymentService.initialize(userId),
        auditService.initialize(userId),
        userService.initialize(userId),
        messagingService.initialize(userId),
      ]);

      const [payments, auth, users, messaging] = await Promise.all([
        paymentService.getStats(),
        auditService.getStats(),
        userService.getStats(),
        messagingService.getStats(),
      ]);

      setPaymentStats(payments);
      setAuthStats(auth);
      setUserStats(users);
      setMessagingStats(messaging);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load dashboard stats'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadStats(user.id);
    }
  }, [user?.id, loadStats]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-base-content/60 mt-1">
          System overview across all users
        </p>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <AdminDashboardOverview
        paymentStats={paymentStats}
        authStats={authStats}
        userStats={userStats}
        messagingStats={messagingStats}
        isLoading={isLoading}
        testId="admin-overview"
      />
    </div>
  );
}
