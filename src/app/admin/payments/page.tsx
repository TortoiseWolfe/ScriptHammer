'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminPaymentService } from '@/services/admin/admin-payment-service';
import { AdminPaymentPanel } from '@/components/organisms/AdminPaymentPanel';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { PaymentActivity } from '@/types/payment';

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminPaymentStats | null>(null);
  const [transactions, setTransactions] = useState<PaymentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminPaymentService(supabase);

    try {
      await service.initialize(userId);
      const [paymentStats, recentTransactions] = await Promise.all([
        service.getStats(),
        service.getRecentTransactions(),
      ]);
      setStats(paymentStats);
      setTransactions(recentTransactions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load payment data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadData(user.id);
    }
  }, [user?.id, loadData]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Payment Activity</h1>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <AdminPaymentPanel
        stats={stats}
        transactions={transactions}
        isLoading={isLoading}
        testId="admin-payments"
      />
    </div>
  );
}
