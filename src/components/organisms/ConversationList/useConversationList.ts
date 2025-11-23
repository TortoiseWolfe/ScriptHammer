import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  ConversationWithParticipants,
  UserProfile,
} from '@/types/messaging';

export interface ConversationListItem {
  id: string;
  participant: UserProfile;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
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
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        setLoading(false);
        return;
      }

      // Get all conversations for this user
      const { data: conversationsData, error: convsError } = await (
        supabase as any
      )
        .from('conversations')
        .select('*')
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convsError) throw convsError;
      if (!conversationsData) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // For each conversation, get participant info and unread count
      const conversationItems: ConversationListItem[] = await Promise.all(
        conversationsData.map(async (conv: any) => {
          // Determine other participant
          const otherParticipantId =
            conv.participant_1_id === user.id
              ? conv.participant_2_id
              : conv.participant_1_id;

          // Get participant profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', otherParticipantId)
            .single();

          // Get unread count (messages not sent by current user, not read)
          const { count: unreadCount } = await (supabase as any)
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);

          // Get last message preview
          const { data: lastMessageData } = await (supabase as any)
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
            lastMessage: lastMessageData ? '[Encrypted message]' : null, // We can't decrypt here without full message object
            lastMessageAt: conv.last_message_at,
            unreadCount: unreadCount || 0,
          };
        })
      );

      setConversations(conversationItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (filterType === 'unread' && conv.unreadCount === 0) {
        return false;
      }
      // TODO: Add archived support in future
      if (filterType === 'archived') {
        return false; // No archived conversations yet
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
        () => {
          // Reload conversations when any conversation changes
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
        () => {
          // Reload when new messages arrive (updates last_message_at)
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  return {
    conversations: filteredConversations,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    sortType,
    setSortType,
    reload: loadConversations,
  };
}
