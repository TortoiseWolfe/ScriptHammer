import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { messageService } from '@/services/messaging/message-service';
import type { UserProfile } from '@/types/messaging';
import { createLogger } from '@/lib/logger/logger';
import { createMessagingClient } from '@/lib/supabase/messaging-client';

const logger = createLogger('components:organisms:ConversationList:hook');

export interface ConversationListItem {
  id: string;
  /** For 1-to-1: the other participant. For groups: undefined */
  participant?: UserProfile;
  /** Group flag - Feature 010 */
  isGroup: boolean;
  /** Group name (null for auto-generated) - Feature 010 */
  groupName?: string | null;
  /** Member count for groups - Feature 010 */
  memberCount?: number;
  /** Member profiles for groups (up to 3 for avatar stack) - Feature 010 */
  groupMembers?: UserProfile[];
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
 * - Loading conversations from Supabase (1-to-1 and groups)
 * - Search by participant name or group name
 * - Filter by unread/archived status
 * - Sort by recent/alphabetical/unread
 * - Real-time updates via Supabase subscriptions
 *
 * Feature 010: Group Chats support
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

      // Get all 1-to-1 conversations for this user
      const directResult = await msgClient
        .from('conversations')
        .select(
          'id, participant_1_id, participant_2_id, last_message_at, archived_by_participant_1, archived_by_participant_2, is_group, group_name'
        )
        .eq('is_group', false)
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      const directData = directResult.data as Array<{
        id: string;
        participant_1_id: string;
        participant_2_id: string;
        last_message_at: string | null;
        archived_by_participant_1: boolean | null;
        archived_by_participant_2: boolean | null;
        is_group: boolean;
        group_name: string | null;
      }> | null;

      // Get all group conversations the user is a member of (Feature 010)
      const groupMemberships = await msgClient
        .from('conversation_members')
        .select('conversation_id, archived, muted')
        .eq('user_id', user.id)
        .is('left_at', null);

      const groupIds = (groupMemberships.data || []).map(
        (m) => m.conversation_id
      );

      let groupData: Array<{
        id: string;
        group_name: string | null;
        last_message_at: string | null;
        created_by: string | null;
        current_key_version: number;
      }> | null = null;

      if (groupIds.length > 0) {
        const groupResult = await msgClient
          .from('conversations')
          .select(
            'id, group_name, last_message_at, created_by, current_key_version'
          )
          .eq('is_group', true)
          .in('id', groupIds)
          .order('last_message_at', { ascending: false, nullsFirst: false });

        groupData = groupResult.data;
      }

      // Process direct conversations
      const directItems: ConversationListItem[] = await Promise.all(
        (directData || []).map(async (conv) => {
          const isParticipant1 = conv.participant_1_id === user.id;
          const otherParticipantId = isParticipant1
            ? conv.participant_2_id
            : conv.participant_1_id;

          const isArchived = isParticipant1
            ? conv.archived_by_participant_1 === true
            : conv.archived_by_participant_2 === true;

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', otherParticipantId)
            .single();

          const { count: unreadCount } = await msgClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);

          const { data: lastMessageData } = await msgClient
            .from('messages')
            .select('encrypted_content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            id: conv.id,
            isGroup: false,
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

      // Process group conversations (Feature 010)
      const groupItems: ConversationListItem[] = await Promise.all(
        (groupData || []).map(async (conv) => {
          // Get member info for this group
          const { data: members } = await msgClient
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conv.id)
            .is('left_at', null);

          const memberCount = members?.length || 0;
          const memberIds = (members || [])
            .map((m) => m.user_id)
            .filter((id) => id !== user.id)
            .slice(0, 3);

          // Get profiles for avatar stack
          const { data: memberProfiles } = await supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', memberIds);

          // Check if user has archived this group
          const membership = (groupMemberships.data || []).find(
            (m) => m.conversation_id === conv.id
          );
          const isArchived = membership?.archived === true;

          // Get unread count
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
            isGroup: true,
            groupName: conv.group_name,
            memberCount,
            groupMembers: (memberProfiles as UserProfile[]) || [],
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

      // Combine and sort all conversations by last_message_at
      const allConversations = [...directItems, ...groupItems].sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      setConversations(allConversations);
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
      // Search filter - check participant name or group name
      if (searchQuery) {
        if (conv.isGroup) {
          // Search by group name or member names
          const groupName = conv.groupName || '';
          const memberNames = (conv.groupMembers || [])
            .map((m) => m.display_name || m.username || '')
            .join(' ');
          const searchText = `${groupName} ${memberNames}`.toLowerCase();
          if (!searchText.includes(searchQuery.toLowerCase())) {
            return false;
          }
        } else {
          const name =
            conv.participant?.display_name || conv.participant?.username || '';
          if (!name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
          }
        }
      }

      // Type filter
      if (filterType === 'all') {
        return !conv.isArchived;
      }
      if (filterType === 'unread') {
        return !conv.isArchived && conv.unreadCount > 0;
      }
      if (filterType === 'archived') {
        return conv.isArchived;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortType === 'recent') {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      } else if (sortType === 'alphabetical') {
        // Use group name or participant name
        const aName = a.isGroup
          ? a.groupName ||
            a.groupMembers
              ?.map((m) => m.display_name || m.username)
              .join(', ') ||
            ''
          : a.participant?.display_name || a.participant?.username || '';
        const bName = b.isGroup
          ? b.groupName ||
            b.groupMembers
              ?.map((m) => m.display_name || m.username)
              .join(', ') ||
            ''
          : b.participant?.display_name || b.participant?.username || '';
        return aName.localeCompare(bName);
      } else if (sortType === 'unread') {
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
          logger.debug('Realtime: message updated', {
            event: payload.eventType,
          });
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_members',
        },
        (payload) => {
          // Feature 010: Reload when group membership changes
          logger.debug('Realtime: conversation_members change', {
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
      channel.unsubscribe();
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
