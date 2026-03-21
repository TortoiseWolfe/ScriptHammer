'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { messageService } from '@/services/messaging/message-service';
import { keyManagementService } from '@/services/messaging/key-service';
import { connectionService } from '@/services/messaging/connection-service';
import { usePendingMessages } from '@/hooks/usePendingMessages';
import { createLogger } from '@/lib/logger/logger';
import type { DecryptedMessage, SidebarTab } from '@/types/messaging';

const logger = createLogger('hooks:useMessagesPage');

export interface UseMessagesPageReturn {
  // URL-derived state
  conversationId: string | null;
  activeTab: SidebarTab;

  // Data state
  messages: DecryptedMessage[];
  participantName: string;
  loading: boolean;
  sending: boolean;
  hasMore: boolean;
  error: string | null;
  clearError: () => void;
  checkingKeys: boolean;
  needsReAuth: boolean;

  // Badge counts
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  pendingConnectionCount: number;
  setPendingConnectionCount: (count: number) => void;

  // Mobile drawer
  isMobileDrawerOpen: boolean;
  toggleDrawer: () => void;

  // Setup toast
  showSetupToast: boolean;
  dismissSetupToast: () => void;

  // Scroll positions ref
  scrollPositions: React.RefObject<Record<SidebarTab, number>>;

  // Pending messages (offline queue)
  pendingMessages: ReturnType<typeof usePendingMessages>['pendingMessages'];
  retryMessage: ReturnType<typeof usePendingMessages>['retryMessage'];

  // Handlers
  handleTabChange: (tab: SidebarTab) => void;
  handleConversationSelect: (convId: string) => void;
  handleStartConversation: (userId: string) => Promise<string>;
  handleSendMessage: (content: string) => Promise<void>;
  handleEditMessage: (messageId: string, newContent: string) => Promise<void>;
  handleDeleteMessage: (messageId: string) => Promise<void>;
  handleLoadMore: () => void;
  handleReAuthSuccess: () => void;
}

export function useMessagesPage(): UseMessagesPageReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = searchParams?.get('conversation') ?? null;
  const tabParam = searchParams?.get('tab') as SidebarTab | null;

  // Tab state - default to 'chats'
  const [activeTab, setActiveTab] = useState<SidebarTab>(tabParam || 'chats');

  // Scroll position refs for tab state preservation
  const scrollPositions = useRef<Record<SidebarTab, number>>({
    chats: 0,
    connections: 0,
  });

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(
    !conversationId
  );

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState('Unknown User');
  const [needsReAuth, setNeedsReAuth] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(true);

  // Badge counts
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingConnectionCount, setPendingConnectionCount] = useState(0);

  // Post-setup toast
  const [showSetupToast, setShowSetupToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync tab state with URL
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (!tabParam && activeTab !== 'chats') {
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
      setIsMobileDrawerOpen(false);
    },
    [router, searchParams]
  );

  // Handle starting a conversation
  const handleStartConversation = useCallback(
    async (userId: string): Promise<string> => {
      return await connectionService.getOrCreateConversation(userId);
    },
    []
  );

  // Check encryption keys on mount
  useEffect(() => {
    const checkKeys = async () => {
      const hasStoredKeys = await keyManagementService.hasKeys();

      if (!hasStoredKeys) {
        router.push('/messages/setup');
        return;
      }

      const keys = keyManagementService.getCurrentKeys();
      if (!keys) {
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
          toastTimeoutRef.current = setTimeout(
            () => setShowSetupToast(false),
            10000
          );
        }
      }
    };
    checkKeys();

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [router]);

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
        setParticipantName(
          profile.display_name || profile.username || 'Unknown User'
        );
      } else {
        logger.warn('Profile not found', { otherParticipantId });
        setParticipantName('Unknown User');
      }
    } catch (err) {
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

      // Mark undelivered messages from others as delivered (sets delivered_at)
      // before marking as read, so the two timestamps are distinct.
      const undelivered = result.messages.filter(
        (m) => !m.isOwn && !m.delivered_at
      );
      if (undelivered.length > 0) {
        const deliverIds = undelivered.map((m) => m.id);
        messageService.markAsDelivered(deliverIds).catch(() => {});
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

  // Load conversation when selected
  useEffect(() => {
    if (conversationId && !needsReAuth && !checkingKeys) {
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

  // Optimistic UI for queued outgoing messages
  const { pendingMessages, addPending, retryMessage } = usePendingMessages(
    conversationId,
    () => void loadMessages()
  );

  const handleSendMessage = async (content: string) => {
    if (!conversationId) return;

    try {
      setSending(true);
      setError(null);

      const result = await messageService.sendMessage({
        conversation_id: conversationId,
        content,
      });

      if (result.queued) {
        addPending(result.message.id, content);
      } else {
        await loadMessages();
      }
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

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string): Promise<void> => {
      try {
        setError(null);
        await messageService.editMessage({
          message_id: messageId,
          new_content: newContent,
        });
        await loadMessages();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to edit message';
        logger.error('Edit message failed', { messageId, error: err });
        setError(message);
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMessages is stable
    [conversationId]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string): Promise<void> => {
      try {
        setError(null);
        await messageService.deleteMessage(messageId);
        await loadMessages();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete message';
        logger.error('Delete message failed', { messageId, error: err });
        setError(message);
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMessages is stable
    [conversationId]
  );

  const handleReAuthSuccess = useCallback(() => {
    setNeedsReAuth(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsMobileDrawerOpen((prev) => !prev);
  }, []);

  const dismissSetupToast = useCallback(() => {
    setShowSetupToast(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    conversationId,
    activeTab,
    messages,
    participantName,
    loading,
    sending,
    hasMore,
    error,
    clearError,
    checkingKeys,
    needsReAuth,
    unreadCount,
    setUnreadCount,
    pendingConnectionCount,
    setPendingConnectionCount,
    isMobileDrawerOpen,
    toggleDrawer,
    showSetupToast,
    dismissSetupToast,
    scrollPositions,
    pendingMessages,
    retryMessage,
    handleTabChange,
    handleConversationSelect,
    handleStartConversation,
    handleSendMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleLoadMore,
    handleReAuthSuccess,
  };
}
