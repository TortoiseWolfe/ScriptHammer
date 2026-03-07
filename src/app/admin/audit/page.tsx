'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminAuditService } from '@/services/admin/admin-audit-service';
import { AdminAuditTrail } from '@/components/organisms/AdminAuditTrail';
import type {
  AdminAuthStats,
  AuditLogEntry,
  AdminAuditTrends,
} from '@/services/admin/admin-audit-service';
import type { DateRange } from '@/components/molecular/DateRangeFilter';

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminAuthStats | null>(null);
  const [events, setEvents] = useState<AuditLogEntry[]>([]);
  const [trends, setTrends] = useState<AdminAuditTrends | null>(null);
  const [range, setRange] = useState<DateRange>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState('');

  // Hold the initialized service so range changes can refetch trends alone
  // without re-running initialize() or the stats call.
  const serviceRef = useRef<AdminAuditService | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminAuditService(supabase);

    try {
      await service.initialize(userId);
      serviceRef.current = service;
      const [authStats, auditEvents, auditTrends] = await Promise.all([
        service.getStats(),
        service.getRecentEvents(100),
        service.getTrends(),
      ]);
      setStats(authStats);
      setEvents(auditEvents);
      setTrends(auditTrends);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load audit data'
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
      const auditTrends = await service.getTrends(
        new Date(next.start),
        new Date(next.end)
      );
      setTrends(auditTrends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends');
    }
  }, []);

  const handleEventTypeChange = useCallback(async (eventType: string) => {
    setEventTypeFilter(eventType);
    const service = serviceRef.current;
    if (!service) return;
    try {
      const auditEvents = await service.getRecentEvents(
        100,
        eventType || undefined
      );
      setEvents(auditEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
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
        <h1 className="text-3xl font-bold">Audit Trail</h1>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <AdminAuditTrail
        stats={stats}
        events={events}
        trends={trends}
        range={range}
        onRangeChange={handleRangeChange}
        isLoading={isLoading}
        eventTypeFilter={eventTypeFilter}
        onEventTypeChange={handleEventTypeChange}
        testId="admin-audit"
      />
    </div>
  );
}
