'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import {
  AdminOverviewService,
  type AdminOverview,
} from '@/services/admin/admin-overview-service';
import { AdminDashboardOverview } from '@/components/organisms/AdminDashboardOverview';
import type { DateRange } from '@/components/molecular/DateRangeFilter';

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [range, setRange] = useState<DateRange>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hold the initialized service so range changes can re-call getOverview
  // without re-running initialize().
  const serviceRef = useRef<AdminOverviewService | null>(null);

  // One service, one round-trip. The old page made four initialize() +
  // four getStats() calls — eight promises to manage, four state slots to
  // keep coherent. The composite RPC collapses that to a single awaited
  // value that either resolves whole or throws.
  const loadOverview = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminOverviewService(supabase);

    try {
      await service.initialize(userId);
      serviceRef.current = service;
      setOverview(await service.getOverview());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load dashboard stats'
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
      // Unlike payments where only trends follow the range, the composite
      // RPC re-windows sparks inside the same payload. The *_stats blocks
      // come back identical (they're all-time); only sparks.* changes.
      setOverview(
        await service.getOverview(new Date(next.start), new Date(next.end))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadOverview(user.id);
    }
  }, [user?.id, loadOverview]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-base-content mt-1">
          System overview across all users
        </p>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <AdminDashboardOverview
        overview={overview}
        dateRange={range}
        onDateRangeChange={handleRangeChange}
        isLoading={isLoading}
        testId="admin-overview"
      />
    </div>
  );
}
