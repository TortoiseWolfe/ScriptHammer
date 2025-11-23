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
    } catch (err: any) {
      setError(err.message || 'Failed to load connections');
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
    } catch (err: any) {
      setError(err.message || 'Failed to accept request');
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
    } catch (err: any) {
      setError(err.message || 'Failed to decline request');
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
    } catch (err: any) {
      setError(err.message || 'Failed to block user');
      throw err;
    }
  };

  const removeConnection = async (connectionId: string) => {
    setError(null);
    try {
      await connectionService.removeConnection(connectionId);
      await fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to remove connection');
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
