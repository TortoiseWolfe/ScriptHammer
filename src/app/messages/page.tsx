'use client';

import React, {
  useState,
  useEffect,
  Suspense,
  useCallback,
  useRef,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatWindow from '@/components/organisms/ChatWindow';
import UnifiedSidebar from '@/components/organisms/UnifiedSidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ReAuthModal } from '@/components/auth/ReAuthModal';
import { MessagingGate } from '@/components/auth/MessagingGate';
import { messageService } from '@/services/messaging/message-service';
import { keyManagementService } from '@/services/messaging/key-service';
import { connectionService } from '@/services/messaging/connection-service';
import { createLogger } from '@/lib/logger/logger';
import type { DecryptedMessage, SidebarTab } from '@/types/messaging';

const logger = createLogger('app:messages');

/**
 * Messages Content Component - wrapped in Suspense boundary
 */
function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = searchParams?.get('conversation');
  const tabParam = searchParams?.get('tab') as SidebarTab | null;

  // Tab state - default to 'chats'
  const [activeTab, setActiveTab] = useState<SidebarTab>(tabParam || 'chats');

  // Scroll position refs for tab state preservation
  const scrollPositions = useRef<Record<SidebarTab, number>>({
    chats: 0,
    connections: 0,
  });

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(!conversationId);

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState('Unknown User');
  const [needsReAuth, setNeedsReAuth] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(true);

  // Badge counts (will be populated from child components)
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingConnectionCount, setPendingConnectionCount] = useState(0);

  // Sync tab state with URL
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (!tabParam && activeTab !== 'chats') {
      // Reset to chats tab when no tab param in URL
      setActiveTab('chats');
    }
  }, [tabParam, activeTab]);

  // Handle tab change - update URL
  const handleTabChange = useCallback(
    (tab: SidebarTab) => {
      // Save current scroll position
      const sidebarContent = document.querySelector('[role="tabpanel"]');
      if (sidebarContent) {
        scrollPositions.current[activeTab] = sidebarContent.scrollTop;
      }

      setActiveTab(tab);

      // Update URL without navigation
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('tab', tab);
      router.replace(`/messages?${params.toString()}`, { scroll: false });

      // Restore scroll position for new tab
      setTimeout(() => {
        const newSidebarContent = document.querySelector('[role="tabpanel"]');
        if (newSidebarContent) {
          newSidebarContent.scrollTop = scrollPositions.current[tab];
        }
      }, 0);
    },
    [activeTab, router, searchParams]
  );

  // Handle conversation selection
  const handleConversationSelect = useCallback(
    (convId: string) => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('conversation', convId);
      params.set('tab', 'chats');
      router.push(`/messages?${params.toString()}`);

      // Close drawer on mobile
      setIsMobileDrawerOpen(false);
    },
    [router, searchParams]
  );

  // Handle starting a conversation (from ConnectionManager "Message" button)
  const handleStartConversation = useCallback(
    async (userId: string): Promise<string> => {
      const convId = await connectionService.getOrCreateConversation(userId);
      return convId;
    },
    []
  );

  // State for post-setup toast
  const [showSetupToast, setShowSetupToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if encryption keys are available on mount
  useEffect(() => {
    const checkKeys = async () => {
      // First check if user has keys stored in database
      const hasStoredKeys = await keyManagementService.hasKeys();

      if (!hasStoredKeys) {
        // No keys at all - redirect to setup page (full page for password manager)
        router.push('/messages/setup');
        return;
      }

      // User has keys in database, check if they're in memory
      const keys = keyManagementService.getCurrentKeys();
      if (!keys) {
        // Keys exist but not in memory - need to unlock
        setNeedsReAuth(true);
      }
      setCheckingKeys(false);

      // Check for post-setup toast
      if (typeof sessionStorage !== 'undefined') {
        const setupComplete = sessionStorage.getItem(
          'messaging_setup_complete'
        );
        if (setupComplete === 'true') {
          setShowSetupToast(true);
          sessionStorage.removeItem('messaging_setup_complete');
          // Auto-dismiss after 10 seconds - store in ref for cleanup (FR-003)
          toastTimeoutRef.current = setTimeout(
            () => setShowSetupToast(false),
            10000
          );
        }
      }
    };
    checkKeys();

    // Cleanup toast timeout on unmount (FR-003)
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [router]);

  useEffect(() => {
    if (conversationId && !needsReAuth && !checkingKeys) {
      // Chain loadConversationInfo then loadMessages to ensure participant info is available before messages render (FR-019)
      loadConversationInfo().then(() => loadMessages());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConversationInfo and loadMessages are intentionally excluded to prevent re-fetching when other state changes; they should only run when conversationId/auth state changes (FR-005)
  }, [conversationId, needsReAuth, checkingKeys]);

  // Update drawer state when conversation changes
  useEffect(() => {
    if (conversationId) {
      setIsMobileDrawerOpen(false);
    }
  }, [conversationId]);

  const loadConversationInfo = async () => {
    if (!conversationId) return;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { createMessagingClient } = await import(
        '@/lib/supabase/messaging-client'
      );
      const supabase = createClient();
      const msgClient = createMessagingClient(supabase);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const result = await msgClient
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', conversationId)
        .single();

      const conversation = result.data as {
        participant_1_id: string;
        participant_2_id: string;
      } | null;

      if (!conversation) {
        logger.warn('Conversation not found', { conversationId });
        return;
      }

      const otherParticipantId =
        conversation.participant_1_id === user.id
          ? conversation.participant_2_id
          : conversation.participant_1_id;

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('id', otherParticipantId)
        .maybeSingle();

      if (profileError) {
        logger.warn('Profile query error', { error: profileError.message });
        setParticipantName('Unknown User');
        return;
      }

      if (profile) {
        // Prefer display_name, fallback to username, then "Unknown User"
        setParticipantName(
          profile.display_name || profile.username || 'Unknown User'
        );
      } else {
        // Profile not found - could be deleted user or orphaned conversation
        logger.warn('Profile not found', { otherParticipantId });
        setParticipantName('Unknown User');
      }
    } catch (err) {
      // Log the error for debugging (FR-004)
      logger.warn('Error loading participant info', { error: err });
      setParticipantName('Unknown User');
    }
  };

  const loadMessages = async (loadMore = false) => {
    if (!conversationId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await messageService.getMessageHistory(
        conversationId,
        loadMore ? cursor : null,
        50
      );

      if (loadMore) {
        setMessages((prev) => [...result.messages, ...prev]);
      } else {
        setMessages(result.messages);

        if (result.messages.length > 0) {
          const firstOtherMessage = result.messages.find((m) => !m.isOwn);
          if (firstOtherMessage) {
            setParticipantName(firstOtherMessage.senderName);
          }
        }
      }

      const unreadMessages = result.messages.filter(
        (m) => !m.isOwn && !m.read_at
      );
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map((m) => m.id);
        messageService.markAsRead(messageIds).catch(() => {});
      }

      setHasMore(result.has_more);
      setCursor(result.cursor);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load messages';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!conversationId) return;

    try {
      setSending(true);
      setError(null);

      await messageService.sendMessage({
        conversation_id: conversationId,
        content,
      });

      await loadMessages();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMessages(true);
    }
  };

  const handleReAuthSuccess = useCallback(() => {
    setNeedsReAuth(false);
  }, []);

  // Toggle drawer on mobile
  const toggleDrawer = useCallback(() => {
    setIsMobileDrawerOpen((prev) => !prev);
  }, []);

  if (checkingKeys) {
    return (
      <div className="fixed inset-x-0 top-16 bottom-28 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <>
      <ReAuthModal isOpen={needsReAuth} onSuccess={handleReAuthSuccess} />

      {/* Post-setup toast reminder to save password */}
      {showSetupToast && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <span className="font-semibold">Encryption set up!</span>
              <p className="text-sm">
                Make sure you saved your messaging password - you&apos;ll need
                it on new devices.
              </p>
            </div>
            <button
              onClick={() => setShowSetupToast(false)}
              className="btn btn-ghost btn-sm"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="bg-base-100 fixed inset-x-0 top-16 bottom-28 overflow-hidden">
        {/* Mobile Drawer Pattern - fixed positioning with footer clearance */}
        <div className="drawer md:drawer-open h-full">
          <input
            id="sidebar-drawer"
            type="checkbox"
            className="drawer-toggle"
            checked={isMobileDrawerOpen}
            onChange={toggleDrawer}
          />

          {/* Main Content (Chat Window) - CSS Grid for reliable height */}
          <div className="drawer-content flex h-full flex-col overflow-hidden md:ml-80 lg:ml-96">
            {/* Mobile header with menu button - shrink-0 keeps fixed height */}
            <div className="navbar bg-base-100 border-base-300 shrink-0 border-b md:hidden">
              <div className="flex-none">
                <label
                  htmlFor="sidebar-drawer"
                  className="btn btn-square btn-ghost min-h-11 min-w-11"
                  aria-label="Open sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block h-5 w-5 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    ></path>
                  </svg>
                </label>
              </div>
              <div className="flex-1">
                <span className="text-lg font-semibold">
                  {conversationId ? participantName : 'Messages'}
                </span>
              </div>
            </div>

            {/* Chat content - flex column for error banner + ChatWindow */}
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {conversationId ? (
                <>
                  {error && (
                    <div className="alert alert-info m-4 shrink-0" role="alert">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="h-6 w-6 shrink-0 stroke-current"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <span>{error}</span>
                      <button
                        onClick={() => setError(null)}
                        className="btn btn-ghost btn-sm min-h-11"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                  <ErrorBoundary level="component">
                    <ChatWindow
                      conversationId={conversationId}
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      onLoadMore={handleLoadMore}
                      hasMore={hasMore}
                      loading={loading}
                      sending={sending}
                      participantName={participantName}
                      className="min-h-0 flex-1"
                    />
                  </ErrorBoundary>
                </>
              ) : (
                <div className="bg-base-200 flex h-full items-center justify-center">
                  <div className="text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="text-base-content/30 mx-auto mb-4 h-24 w-24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                      />
                    </svg>
                    <h2 className="mb-2 text-xl font-semibold">
                      Select a conversation
                    </h2>
                    <p className="text-base-content/70">
                      Choose a conversation from the sidebar to start messaging
                    </p>
                    <button
                      className="btn btn-primary mt-4 min-h-11 md:hidden"
                      onClick={toggleDrawer}
                    >
                      Open Sidebar
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* Sidebar Drawer */}
          <div className="drawer-side z-40">
            <label
              htmlFor="sidebar-drawer"
              aria-label="Close sidebar"
              className="drawer-overlay"
            ></label>
            <aside className="bg-base-100 border-base-300 h-full w-80 overflow-y-auto border-r lg:w-96">
              <UnifiedSidebar
                selectedConversationId={conversationId}
                onConversationSelect={handleConversationSelect}
                onStartConversation={handleStartConversation}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                unreadCount={unreadCount}
                onUnreadCountChange={setUnreadCount}
                pendingConnectionCount={pendingConnectionCount}
                onPendingConnectionCountChange={setPendingConnectionCount}
              />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Messages Page with Unified Sidebar and Mobile Drawer Pattern
 *
 * Mobile: Drawer-based sidebar with tabs (Chats, Connections)
 * Tablet+: Side-by-side sidebar and chat window
 *
 * Usage:
 * - /messages → Chats tab (default)
 * - /messages?tab=connections → Connections tab (includes UserSearch)
 * - /messages?conversation=<id> → Open specific conversation
 *
 * Feature 038: Consolidated to 2 tabs - UserSearch embedded in ConnectionManager
 * @see Feature 037 - Unified Messaging Sidebar
 */
export default function MessagesPage() {
  return (
    <MessagingGate>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        }
      >
        <MessagesContent />
      </Suspense>
    </MessagingGate>
  );
}
