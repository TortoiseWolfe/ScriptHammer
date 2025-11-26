'use client';

import React from 'react';
import ConversationList from '@/components/organisms/ConversationList';
import ConnectionManager from '@/components/organisms/ConnectionManager';
import UserSearch from '@/components/molecular/UserSearch';
import type { SidebarTab } from '@/types/messaging';

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
  /** Pending connection count for badge display */
  pendingConnectionCount?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * UnifiedSidebar - Tabbed sidebar for messaging with Chats, Connections, and Find People tabs
 * @see Feature 037 - Unified Messaging Sidebar
 */
export default function UnifiedSidebar({
  selectedConversationId,
  onConversationSelect,
  onStartConversation,
  activeTab,
  onTabChange,
  unreadCount = 0,
  pendingConnectionCount = 0,
  className = '',
}: UnifiedSidebarProps) {
  const handleMessage = async (userId: string) => {
    try {
      const conversationId = await onStartConversation(userId);
      onConversationSelect(conversationId);
      // Switch to chats tab after starting conversation
      onTabChange('chats');
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  return (
    <div
      className={`unified-sidebar flex h-full flex-col ${className}`}
      data-testid="unified-sidebar"
    >
      {/* Tab Navigation */}
      <div
        role="tablist"
        className="tabs tabs-bordered flex-shrink-0 px-4 pt-4"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'chats'}
          className={`tab min-h-11 gap-2 ${activeTab === 'chats' ? 'tab-active' : ''}`}
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
          className={`tab min-h-11 gap-2 ${activeTab === 'connections' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('connections')}
        >
          Connections
          {pendingConnectionCount > 0 && (
            <span className="badge badge-secondary badge-sm">
              {pendingConnectionCount}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'find'}
          className={`tab min-h-11 ${activeTab === 'find' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('find')}
        >
          Find People
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {activeTab === 'chats' && (
          <ConversationList selectedConversationId={selectedConversationId} />
        )}
        {activeTab === 'connections' && (
          <div className="p-4">
            <ConnectionManager onMessage={handleMessage} />
          </div>
        )}
        {activeTab === 'find' && (
          <div className="p-4">
            <UserSearch />
          </div>
        )}
      </div>
    </div>
  );
}
