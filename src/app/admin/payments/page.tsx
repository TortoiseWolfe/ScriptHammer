'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminPaymentService } from '@/services/admin/admin-payment-service';
import { AdminPaymentPanel } from '@/components/organisms/AdminPaymentPanel';
import type {
  AdminPaymentStats,
  AdminPaymentTrends,
} from '@/services/admin/admin-payment-service';
import type { PaymentActivity } from '@/types/payment';
import type { DateRange } from '@/components/molecular/DateRangeFilter';

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminPaymentStats | null>(null);
  const [transactions, setTransactions] = useState<PaymentActivity[]>([]);
  const [trends, setTrends] = useState<AdminPaymentTrends | null>(null);
  const [range, setRange] = useState<DateRange>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hold the initialized service so range changes can refetch trends alone
  // without re-running initialize() or the stats/transactions calls.
  const serviceRef = useRef<AdminPaymentService | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminPaymentService(supabase);

    try {
      await service.initialize(userId);
      serviceRef.current = service;
      const [paymentStats, recentTransactions, paymentTrends] =
        await Promise.all([
          service.getStats(),
          service.getRecentTransactions(),
          service.getTrends(),
        ]);
      setStats(paymentStats);
      setTransactions(recentTransactions);
      setTrends(paymentTrends);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load payment data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRangeChange = useCallback(async (next: DateRange) => {
    setRange(next);
    // DateRangeFilter fires on every keystroke. Only hit the RPC once both
    // ends are filled (presets always fill both).
    if (!next.start || !next.end) return;
    const service = serviceRef.current;
    if (!service) return;
    try {
      const paymentTrends = await service.getTrends(
        new Date(next.start),
        new Date(next.end)
      );
      setTrends(paymentTrends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends');
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
        trends={trends}
        range={range}
        onRangeChange={handleRangeChange}
        isLoading={isLoading}
        testId="admin-payments"
      />
    </div>
  );
}
