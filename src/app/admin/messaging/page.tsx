'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { AdminMessagingService } from '@/services/admin/admin-messaging-service';
import { AdminMessagingOverview } from '@/components/organisms/AdminMessagingOverview';
import { AdminConversationList } from '@/components/organisms/AdminConversationList';
import type {
  AdminMessagingStats,
  AdminMessagingTrends,
  AdminConversationList as AdminConversationListData,
} from '@/services/admin/admin-messaging-service';
import type { DateRange } from '@/components/molecular/DateRangeFilter';

const CONVERSATION_PAGE_SIZE = 50;

export default function AdminMessagingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminMessagingStats | null>(null);
  const [trends, setTrends] = useState<AdminMessagingTrends | null>(null);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Conversation list state — separate loading flag so paging doesn't
  // put the overview back into skeleton.
  const [convList, setConvList] = useState<AdminConversationListData | null>(
    null
  );
  const [convOffset, setConvOffset] = useState(0);
  const [convLoading, setConvLoading] = useState(true);

  // Hold the initialized service so range refetch doesn't re-initialize.
  const serviceRef = useRef<AdminMessagingService | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setIsLoading(true);
    setConvLoading(true);
    setError(null);

    const service = new AdminMessagingService(supabase);

    try {
      await service.initialize(userId);
      serviceRef.current = service;
      const [messagingStats, messagingTrends, conversations] =
        await Promise.all([
          service.getStats(),
          service.getTrends(),
          service.getConversationList({
            limit: CONVERSATION_PAGE_SIZE,
            offset: 0,
          }),
        ]);
      setStats(messagingStats);
      setTrends(messagingTrends);
      setConvList(conversations);
      setConvOffset(0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load messaging data'
      );
    } finally {
      setIsLoading(false);
      setConvLoading(false);
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

  const handleConversationPageChange = useCallback(
    async (nextOffset: number) => {
      const service = serviceRef.current;
      if (!service) return;
      setConvLoading(true);
      try {
        const page = await service.getConversationList({
          limit: CONVERSATION_PAGE_SIZE,
          offset: nextOffset,
        });
        setConvList(page);
        setConvOffset(nextOffset);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load conversation list'
        );
      } finally {
        setConvLoading(false);
      }
    },
    []
  );

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

      <AdminConversationList
        data={convList?.conversations ?? []}
        total={convList?.total ?? 0}
        offset={convOffset}
        pageSize={CONVERSATION_PAGE_SIZE}
        onPageChange={handleConversationPageChange}
        isLoading={convLoading}
        className="mt-8"
        testId="admin-conversation-list"
      />
    </div>
  );
}
