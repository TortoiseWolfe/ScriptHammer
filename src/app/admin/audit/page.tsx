'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminAuditService } from '@/services/admin/admin-audit-service';
import { AdminAuditTrail } from '@/components/organisms/AdminAuditTrail';
import type {
  AdminAuthStats,
  AuditLogEntry,
} from '@/services/admin/admin-audit-service';

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminAuthStats | null>(null);
  const [events, setEvents] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState('');

  const loadData = useCallback(async (userId: string, eventType: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminAuditService(supabase);

    try {
      await service.initialize(userId);
      const [authStats, auditEvents] = await Promise.all([
        service.getStats(),
        service.getRecentEvents(100, eventType || undefined),
      ]);
      setStats(authStats);
      setEvents(auditEvents);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load audit data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadData(user.id, eventTypeFilter);
    }
  }, [user?.id, eventTypeFilter, loadData]);

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
        isLoading={isLoading}
        eventTypeFilter={eventTypeFilter}
        onEventTypeChange={setEventTypeFilter}
        testId="admin-audit"
      />
    </div>
  );
}
