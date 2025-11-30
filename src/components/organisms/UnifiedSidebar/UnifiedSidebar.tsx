'use client';

import React from 'react';
import ConversationList from '@/components/organisms/ConversationList';
import ConnectionManager from '@/components/organisms/ConnectionManager';
import type { SidebarTab } from '@/types/messaging';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:organisms:UnifiedSidebar');

export interface UnifiedSidebarProps {
  /** Currently selected conversation ID */
  selectedConversationId?: string | null;
  /** Callback when a conversation is selected */
  onConversationSelect: (conversationId: string) => void;
  /** Callback to start conversation with a user (returns conversation ID) */
  onStartConversation: (userId: string) => Promise<string>;
  /** Currently active tab */
  activeTab: SidebarTab;
  /** Callback when tab changes */
  onTabChange: (tab: SidebarTab) => void;
  /** Unread message count for badge display */
  unreadCount?: number;
  /** Callback when unread count changes */
  onUnreadCountChange?: (count: number) => void;
  /** Pending connection count for badge display */
  pendingConnectionCount?: number;
  /** Callback when pending connection count changes (FR-006) */
  onPendingConnectionCountChange?: (count: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * UnifiedSidebar - Tabbed sidebar for messaging with Chats and Connections tabs
 * UserSearch is now embedded inside ConnectionManager (Feature 038 UX Polish)
 * @see Feature 037 - Unified Messaging Sidebar
 */
export default function UnifiedSidebar({
  selectedConversationId,
  onConversationSelect,
  onStartConversation,
  activeTab,
  onTabChange,
  unreadCount = 0,
  onUnreadCountChange,
  pendingConnectionCount = 0,
  onPendingConnectionCountChange,
  className = '',
}: UnifiedSidebarProps) {
  const handleMessage = async (userId: string) => {
    try {
      const conversationId = await onStartConversation(userId);
      onConversationSelect(conversationId);
      // Switch to chats tab after starting conversation
      onTabChange('chats');
    } catch (error) {
      logger.error('Failed to start conversation', { userId, error });
    }
  };

  return (
    <div
      className={`unified-sidebar flex h-full flex-col ${className}`}
      data-testid="unified-sidebar"
    >
      {/* Tab Navigation - Feature 038: Consolidated to 2 tabs */}
      <div
        role="tablist"
        className="tabs tabs-bordered flex-shrink-0 overflow-x-auto px-4 pt-4"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'chats'}
          className={`tab min-h-11 flex-shrink-0 gap-2 ${activeTab === 'chats' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('chats')}
        >
          Chats
          {unreadCount > 0 && (
            <span className="badge badge-primary badge-sm">{unreadCount}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'connections'}
          className={`tab min-h-11 flex-shrink-0 gap-2 ${activeTab === 'connections' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('connections')}
        >
          Connections
          {pendingConnectionCount > 0 && (
            <span className="badge badge-secondary badge-sm">
              {pendingConnectionCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {activeTab === 'chats' && (
          <ConversationList
            selectedConversationId={selectedConversationId}
            onUnreadCountChange={onUnreadCountChange}
          />
        )}
        {activeTab === 'connections' && (
          <div className="p-4">
            <ConnectionManager
              onMessage={handleMessage}
              onPendingConnectionCountChange={onPendingConnectionCountChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
