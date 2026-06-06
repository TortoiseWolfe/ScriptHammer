import { useState, useEffect } from 'react';
import { connectionService } from '@/services/messaging/connection-service';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger/logger';
import type { ConnectionList } from '@/types/messaging';

const logger = createLogger('hooks:useConnections');

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionList>({
    pending_sent: [],
    pending_received: [],
    accepted: [],
    blocked: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await connectionService.getConnections();
      setConnections(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load connections';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (connectionId: string) => {
    setError(null);
    try {
      await connectionService.respondToRequest({
        connection_id: connectionId,
        action: 'accept',
      });
      await fetchConnections();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to accept request';
      setError(message);
      throw err;
    }
  };

  const declineRequest = async (connectionId: string) => {
    setError(null);
    try {
      await connectionService.respondToRequest({
        connection_id: connectionId,
        action: 'decline',
      });
      await fetchConnections();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to decline request';
      setError(message);
      throw err;
    }
  };

  const blockUser = async (connectionId: string) => {
    setError(null);
    try {
      await connectionService.respondToRequest({
        connection_id: connectionId,
        action: 'block',
      });
      await fetchConnections();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to block user';
      setError(message);
      throw err;
    }
  };

  const removeConnection = async (connectionId: string) => {
    setError(null);
    try {
      await connectionService.removeConnection(connectionId);
      await fetchConnections();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove connection';
      setError(message);
      throw err;
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  // Live-update the badge (#35): refetch on any user_connections change so the
  // pending-connections count reflects accept/request/remove without a remount.
  // user_connections is in the supabase_realtime publication with REPLICA
  // IDENTITY FULL. Mirrors the debounced channel pattern in
  // ConversationList/useConversationList.ts (1s debounce avoids re-render
  // cascades from rapid-fire events); proper cleanup on unmount.
  useEffect(() => {
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchConnections(), 1000);
    };

    const channel = supabase
      .channel('user-connections')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_connections' },
        (payload) => {
          logger.debug('Realtime: user_connections change', {
            event: payload.eventType,
          });
          debouncedFetch();
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime subscription failed', {
            error: err?.message,
          });
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    connections,
    loading,
    error,
    acceptRequest,
    declineRequest,
    blockUser,
    removeConnection,
    refreshConnections: fetchConnections,
  };
}
