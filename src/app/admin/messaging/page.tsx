'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminMessagingService } from '@/services/admin/admin-messaging-service';
import { AdminMessagingOverview } from '@/components/organisms/AdminMessagingOverview';
import type {
  AdminMessagingStats,
  AdminMessagingTrends,
} from '@/services/admin/admin-messaging-service';
import type { DateRange } from '@/components/molecular/DateRangeFilter';

export default function AdminMessagingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminMessagingStats | null>(null);
  const [trends, setTrends] = useState<AdminMessagingTrends | null>(null);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hold the initialized service so range refetch doesn't re-initialize.
  const serviceRef = useRef<AdminMessagingService | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminMessagingService(supabase);

    try {
      await service.initialize(userId);
      serviceRef.current = service;
      const [messagingStats, messagingTrends] = await Promise.all([
        service.getStats(),
        service.getTrends(),
      ]);
      setStats(messagingStats);
      setTrends(messagingTrends);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load messaging data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRangeChange = useCallback(async (next: DateRange) => {
    setRange(next);
    const service = serviceRef.current;
    if (!service) return;
    try {
      const t = await service.getTrends(
        new Date(next.start),
        new Date(next.end)
      );
      setTrends(t);
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
        <h1 className="text-3xl font-bold">Messaging Overview</h1>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <AdminMessagingOverview
        stats={stats}
        trends={trends}
        range={range}
        onRangeChange={handleRangeChange}
        isLoading={isLoading}
        testId="admin-messaging"
      />
    </div>
  );
}
