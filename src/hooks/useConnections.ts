import { useState, useEffect } from 'react';
import { connectionService } from '@/services/messaging/connection-service';
import type { ConnectionList } from '@/types/messaging';

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
