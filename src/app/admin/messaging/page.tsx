'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminMessagingService } from '@/services/admin/admin-messaging-service';
import { AdminMessagingOverview } from '@/components/organisms/AdminMessagingOverview';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

export default function AdminMessagingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminMessagingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const service = new AdminMessagingService(supabase);

    try {
      await service.initialize(userId);
      const messagingStats = await service.getStats();
      setStats(messagingStats);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load messaging data'
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
        <h1 className="text-3xl font-bold">Messaging Overview</h1>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <AdminMessagingOverview
        stats={stats}
        isLoading={isLoading}
        testId="admin-messaging"
      />
    </div>
  );
}
