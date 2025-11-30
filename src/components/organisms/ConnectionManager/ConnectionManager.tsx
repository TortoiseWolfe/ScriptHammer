'use client';

import React, { useState } from 'react';
import { useConnections } from '@/hooks/useConnections';
import UserSearch from '@/components/molecular/UserSearch';
import type { ConnectionRequest } from '@/types/messaging';

export interface ConnectionManagerProps {
  onRefreshAvailable?: (refresh: () => Promise<void>) => void;
  className?: string;
  /** Callback when "Message" button clicked on accepted connection (Feature 037) */
  onMessage?: (userId: string) => void;
  /** Callback when pending connection count changes (FR-007) */
  onPendingConnectionCountChange?: (count: number) => void;
}

export default function ConnectionManager({
  onRefreshAvailable,
  className = '',
  onMessage,
  onPendingConnectionCountChange,
}: ConnectionManagerProps) {
  const {
    connections,
    loading,
    error,
    acceptRequest,
    declineRequest,
    blockUser,
    removeConnection,
    refreshConnections,
  } = useConnections();

  // Expose refresh to parent
  React.useEffect(() => {
    if (onRefreshAvailable) {
      onRefreshAvailable(refreshConnections);
    }
  }, [refreshConnections, onRefreshAvailable]);

  // Report pending connection count changes to parent (FR-007)
  React.useEffect(() => {
    onPendingConnectionCountChange?.(connections.pending_received.length);
  }, [connections.pending_received.length, onPendingConnectionCountChange]);
  const [activeTab, setActiveTab] = useState<
    'sent' | 'received' | 'accepted' | 'blocked'
  >('received');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showBlockModal, setShowBlockModal] = useState<string | null>(null);

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    try {
      await acceptRequest(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionLoading(id);
    try {
      await declineRequest(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (id: string) => {
    setActionLoading(id);
    try {
      await blockUser(id);
      setShowBlockModal(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (id: string) => {
    setActionLoading(id);
    try {
      await removeConnection(id);
    } finally {
      setActionLoading(null);
    }
  };

  const renderConnectionItem = (item: ConnectionRequest, type: string) => {
    const otherUser =
      item.connection.requester_id === item.requester.id
        ? item.addressee
        : item.requester;

    return (
      <div
        key={item.connection.id}
        className="card bg-base-200"
        data-testid="connection-request"
      >
        <div className="card-body p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="avatar placeholder">
                <div className="bg-neutral text-neutral-content w-12 rounded-full">
                  {otherUser.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={otherUser.avatar_url}
                      alt={
                        otherUser.display_name || otherUser.username || 'User'
                      }
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xl">
                      {(otherUser.display_name ||
                        otherUser.username ||
                        'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="font-semibold">
                  {otherUser.display_name ||
                    otherUser.username ||
                    'Unknown User'}
                </p>
                {otherUser.username && otherUser.display_name && (
                  <p className="text-sm opacity-70">@{otherUser.username}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {type === 'received' && (
                <>
                  <button
                    onClick={() => handleAccept(item.connection.id)}
                    disabled={actionLoading === item.connection.id}
                    className="btn btn-success btn-sm min-h-11 min-w-11"
                  >
                    {actionLoading === item.connection.id ? '...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleDecline(item.connection.id)}
                    disabled={actionLoading === item.connection.id}
                    className="btn btn-ghost btn-sm min-h-11 min-w-11"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => setShowBlockModal(item.connection.id)}
                    disabled={actionLoading === item.connection.id}
                    className="btn btn-error btn-sm min-h-11 min-w-11"
                  >
                    Block
                  </button>
                </>
              )}
              {type === 'sent' && (
                <button
                  onClick={() => handleRemove(item.connection.id)}
                  disabled={actionLoading === item.connection.id}
                  className="btn btn-ghost btn-sm min-h-11 min-w-11"
                >
                  Cancel
                </button>
              )}
              {type === 'accepted' && (
                <>
                  {onMessage && (
                    <button
                      onClick={() => onMessage(otherUser.id)}
                      className="btn btn-primary btn-sm min-h-11 min-w-11"
                      data-testid="message-button"
                    >
                      Message
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(item.connection.id)}
                    disabled={actionLoading === item.connection.id}
                    className="btn btn-ghost btn-sm min-h-11 min-w-11"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`connection-manager${className ? ` ${className}` : ''}`}
      data-testid="connection-manager"
    >
      {/* Search for new connections */}
      <div className="mb-6">
        <UserSearch />
      </div>

      {/* Manage existing connections */}
      <div role="tablist" className="tabs tabs-bordered mb-6">
        <button
          role="tab"
          className={`tab min-h-11 ${activeTab === 'received' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          Pending Received ({connections.pending_received.length})
        </button>
        <button
          role="tab"
          className={`tab min-h-11 ${activeTab === 'sent' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          Pending Sent ({connections.pending_sent.length})
        </button>
        <button
          role="tab"
          className={`tab min-h-11 ${activeTab === 'accepted' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          Accepted ({connections.accepted.length})
        </button>
        <button
          role="tab"
          className={`tab min-h-11 ${activeTab === 'blocked' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('blocked')}
        >
          Blocked ({connections.blocked.length})
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <span
            className="loading loading-spinner loading-lg"
            role="status"
            aria-label="Loading connections"
          ></span>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === 'received' &&
            connections.pending_received.map((item) =>
              renderConnectionItem(item, 'received')
            )}
          {activeTab === 'sent' &&
            connections.pending_sent.map((item) =>
              renderConnectionItem(item, 'sent')
            )}
          {activeTab === 'accepted' &&
            connections.accepted.map((item) =>
              renderConnectionItem(item, 'accepted')
            )}
          {activeTab === 'blocked' &&
            connections.blocked.map((item) =>
              renderConnectionItem(item, 'blocked')
            )}

          {((activeTab === 'received' &&
            connections.pending_received.length === 0) ||
            (activeTab === 'sent' && connections.pending_sent.length === 0) ||
            (activeTab === 'accepted' && connections.accepted.length === 0) ||
            (activeTab === 'blocked' && connections.blocked.length === 0)) && (
            <div className="py-8 text-center opacity-70">
              <p>No {activeTab} connections</p>
            </div>
          )}
        </div>
      )}

      {showBlockModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold">Block User</h3>
            <p className="py-4">
              Are you sure you want to block this user? They won&apos;t be able
              to send you messages.
            </p>
            <div className="modal-action">
              <button
                onClick={() => setShowBlockModal(null)}
                className="btn min-h-11"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBlock(showBlockModal)}
                className="btn btn-error min-h-11"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
