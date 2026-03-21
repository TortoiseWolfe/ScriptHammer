'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UnifiedSidebar from '@/components/organisms/UnifiedSidebar';
import { connectionService } from '@/services/messaging/connection-service';
import type { SidebarTab } from '@/types/messaging';

export interface MessagesSidebarProps {
  /** Currently active conversation (for highlighting in the list) */
  selectedConversationId: string | null;
  /** Called when user picks a conversation from the list or starts one
   *  via ConnectionManager. Page is responsible for URL update + drawer close. */
  onConversationSelect: (conversationId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * MessagesSidebar — tab-stateful wrapper around UnifiedSidebar.
 *
 * Extracted from app/messages/page.tsx. Owns everything sidebar-scoped:
 * activeTab + URL ?tab= sync, per-tab scroll position preservation across
 * tab switches, unread/pending badge counts, and the getOrCreateConversation
 * wiring for the "Message" button in the Connections tab.
 *
 * The page supplies only selectedConversationId and onConversationSelect —
 * everything below that boundary is local state.
 *
 * @category organisms
 */
export default function MessagesSidebar({
  selectedConversationId,
  onConversationSelect,
  className = '',
}: MessagesSidebarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams?.get('tab') as SidebarTab | null;

  const [activeTab, setActiveTab] = useState<SidebarTab>(tabParam || 'chats');
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingConnectionCount, setPendingConnectionCount] = useState(0);

  // Per-tab scroll offsets. Saved on tab-out, restored on tab-in.
  const scrollPositions = useRef<Record<SidebarTab, number>>({
    chats: 0,
    connections: 0,
  });

  // ── URL → state sync ───────────────────────────────────────────────
  // Reset to 'chats' when ?tab= disappears (e.g. router.back).
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (!tabParam && activeTab !== 'chats') {
      setActiveTab('chats');
    }
  }, [tabParam, activeTab]);

  // ── state → URL sync + scroll preservation ─────────────────────────
  const handleTabChange = useCallback(
    (tab: SidebarTab) => {
      // Save scroll offset of the outgoing tabpanel
      const sidebarContent = document.querySelector('[role="tabpanel"]');
      if (sidebarContent) {
        scrollPositions.current[activeTab] = sidebarContent.scrollTop;
      }

      setActiveTab(tab);

      // router.replace — tab switching shouldn't stack history entries
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('tab', tab);
      router.replace(`/messages?${params.toString()}`, { scroll: false });

      // Restore scroll on the incoming tabpanel. setTimeout(0) waits for
      // the new panel to mount.
      setTimeout(() => {
        const newSidebarContent = document.querySelector('[role="tabpanel"]');
        if (newSidebarContent) {
          newSidebarContent.scrollTop = scrollPositions.current[tab];
        }
      }, 0);
    },
    [activeTab, router, searchParams]
  );

  // Fired from ConnectionManager's "Message" button. Get-or-create the
  // conversation, hand the ID to the page. UnifiedSidebar handles the
  // select+tab-switch after this resolves.
  const handleStartConversation = useCallback(
    async (userId: string): Promise<string> => {
      return connectionService.getOrCreateConversation(userId);
    },
    []
  );

  return (
    <aside
      className={`bg-base-100 border-base-300 h-full w-80 overflow-y-auto border-r lg:w-96 ${className}`}
      data-testid="messages-sidebar"
    >
      <UnifiedSidebar
        selectedConversationId={selectedConversationId}
        onConversationSelect={onConversationSelect}
        onStartConversation={handleStartConversation}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadCount={unreadCount}
        onUnreadCountChange={setUnreadCount}
        pendingConnectionCount={pendingConnectionCount}
        onPendingConnectionCountChange={setPendingConnectionCount}
      />
    </aside>
  );
}
