import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { messageService } from '@/services/messaging/message-service';
import type {
  ConversationWithParticipants,
  UserProfile,
} from '@/types/messaging';
import { createLogger } from '@/lib/logger/logger';
import { createMessagingClient } from '@/lib/supabase/messaging-client';

const logger = createLogger('components:organisms:ConversationList:hook');

export interface ConversationListItem {
  id: string;
  participant: UserProfile;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isArchived: boolean;
}

export type FilterType = 'all' | 'unread' | 'archived';
export type SortType = 'recent' | 'alphabetical' | 'unread';

/**
 * Custom hook for ConversationList component
 *
 * Manages:
 * - Loading conversations from Supabase
 * - Search by participant name
 * - Filter by unread/archived status
 * - Sort by recent/alphabetical/unread
 * - Real-time updates via Supabase subscriptions
 */
export function useConversationList() {
  // Use auth context for user - prevents race conditions with getUser()
  const { user: authUser, isLoading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('recent');

  // Load conversations from database
  const loadConversations = useCallback(async () => {
    // Wait for auth to be ready
    if (authLoading) {
      return;
    }

    // Use user from AuthContext instead of calling getUser()
    // This prevents race conditions with async getUser() calls
    const user = authUser;

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const msgClient = createMessagingClient(supabase);

      // Get all conversations for this user
      const result = await msgClient
        .from('conversations')
        .select(
          'id, participant_1_id, participant_2_id, last_message_at, archived_by_participant_1, archived_by_participant_2'
        )
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      const conversationsData = result.data as Array<{
        id: string;
        participant_1_id: string;
        participant_2_id: string;
        last_message_at: string | null;
        archived_by_participant_1: boolean | null;
        archived_by_participant_2: boolean | null;
      }> | null;

      const convsError = result.error;

      // DEBUG: Log query results
      logger.debug('Query results', {
        error: convsError,
        dataCount: conversationsData?.length,
      });

      if (convsError) throw convsError;
      if (!conversationsData) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // For each conversation, get participant info and unread count
      const conversationItems: ConversationListItem[] = await Promise.all(
        conversationsData.map(async (conv) => {
          // Determine other participant and archive status based on user's role
          const isParticipant1 = conv.participant_1_id === user.id;
          const otherParticipantId = isParticipant1
            ? conv.participant_2_id
            : conv.participant_1_id;

          // Determine if current user has archived this conversation
          const isArchived = isParticipant1
            ? conv.archived_by_participant_1 === true
            : conv.archived_by_participant_2 === true;

          // Get participant profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', otherParticipantId)
            .single();

          // Get unread count (messages not sent by current user, not read)
          const { count: unreadCount } = await msgClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);

          // Get last message preview
          const { data: lastMessageData } = await msgClient
            .from('messages')
            .select('encrypted_content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            id: conv.id,
            participant: profile || {
              id: otherParticipantId,
              username: null,
              display_name: null,
              avatar_url: null,
            },
            lastMessage: lastMessageData
              ? unreadCount && unreadCount > 0
                ? 'New message'
                : 'Tap to view'
              : null,
            lastMessageAt: conv.last_message_at,
            unreadCount: unreadCount || 0,
            isArchived,
          };
        })
      );

      setConversations(conversationItems);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load conversations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authUser, authLoading]);

  // Filter conversations based on search and filter type
  const filteredConversations = conversations
    .filter((conv) => {
      // Search filter
      if (searchQuery) {
        const name =
          conv.participant.display_name || conv.participant.username || '';
        if (!name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      // Type filter
      if (filterType === 'all') {
        // 'All' excludes archived conversations
        return !conv.isArchived;
      }
      if (filterType === 'unread') {
        // 'Unread' shows non-archived conversations with unread messages
        return !conv.isArchived && conv.unreadCount > 0;
      }
      if (filterType === 'archived') {
        // 'Archived' shows only archived conversations
        return conv.isArchived;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort logic
      if (sortType === 'recent') {
        // Sort by last_message_at descending
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      } else if (sortType === 'alphabetical') {
        // Sort by participant name ascending
        const aName =
          a.participant.display_name || a.participant.username || '';
        const bName =
          b.participant.display_name || b.participant.username || '';
        return aName.localeCompare(bName);
      } else if (sortType === 'unread') {
        // Sort by unread count descending, then by recent
        if (a.unreadCount !== b.unreadCount) {
          return b.unreadCount - a.unreadCount;
        }
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      }
      return 0;
    });

  // Compute counts from UNFILTERED conversations for tab badges
  const counts = {
    all: conversations.filter((c) => !c.isArchived).length,
    unread: conversations.filter((c) => !c.isArchived && c.unreadCount > 0)
      .length,
    archived: conversations.filter((c) => c.isArchived).length,
    totalUnread: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Set up real-time subscription for conversation updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('conversations-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          // Reload conversations when any conversation changes
          logger.debug('Realtime: conversations change', {
            event: payload.eventType,
          });
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Reload when new messages arrive (updates last_message_at)
          logger.debug('Realtime: new message', { event: payload.eventType });
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Reload when messages are updated (e.g., read_at changes)
          logger.debug('Realtime: message updated', {
            event: payload.eventType,
          });
          loadConversations();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active for conversations-list');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime subscription failed', { error: err?.message });
        } else if (status === 'TIMED_OUT') {
          logger.warn('Realtime subscription timed out');
        } else {
          logger.debug('Realtime subscription status', { status });
        }
      });

    return () => {
      channel.unsubscribe(); // Explicit unsubscribe first (FR-015)
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // Archive a conversation
  const archiveConversation = useCallback(
    async (conversationId: string) => {
      logger.debug('Attempting to archive conversation', { conversationId });
      try {
        await messageService.archiveConversation(conversationId);
        logger.info('Successfully archived conversation', { conversationId });
        // Reload to update the list
        loadConversations();
      } catch (err: unknown) {
        logger.error('Failed to archive conversation', {
          conversationId,
          error: err,
        });
        const message =
          err instanceof Error ? err.message : 'Failed to archive conversation';
        setError(message);
      }
    },
    [loadConversations]
  );

  // Unarchive a conversation
  const unarchiveConversation = useCallback(
    async (conversationId: string) => {
      try {
        await messageService.unarchiveConversation(conversationId);
        // Reload to update the list
        loadConversations();
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to unarchive conversation';
        setError(message);
      }
    },
    [loadConversations]
  );

  return {
    conversations: filteredConversations,
    counts,
    loading: loading || authLoading,
    error,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    sortType,
    setSortType,
    reload: loadConversations,
    archiveConversation,
    unarchiveConversation,
  };
}
