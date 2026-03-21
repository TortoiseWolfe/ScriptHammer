import { useState, useEffect, useRef, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createMessagingClient } from '@/lib/supabase/messaging-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const logger = createLogger('hooks:unreadCount');

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const conversationIdsRef = useRef<string[]>([]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const msgClient = createMessagingClient(supabase);

      // Get all conversations for this user
      const result = await msgClient
        .from('conversations')
        .select('id')
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`);

      const conversations = result.data as { id: string }[] | null;

      if (!conversations || conversations.length === 0) {
        setUnreadCount(0);
        conversationIdsRef.current = [];
        return;
      }

      conversationIdsRef.current = conversations.map((c) => c.id);

      // Count unread messages (messages where read_at is null and sender is NOT current user)
      const { count } = await msgClient
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIdsRef.current)
        .neq('sender_id', user.id)
        .is('read_at', null);

      setUnreadCount(count || 0);
    } catch (error) {
      logger.error('Failed to fetch unread count', { error });
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    // Subscribe to realtime message changes instead of polling
    const channel = supabase
      .channel(`unread-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          // Only refetch if the change is in one of our conversations
          const conversationId =
            (payload.new as { conversation_id?: string })?.conversation_id ||
            (payload.old as { conversation_id?: string })?.conversation_id;

          if (
            conversationId &&
            conversationIdsRef.current.includes(conversationId)
          ) {
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Refetch when tab regains focus (covers gaps if realtime dropped while backgrounded)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchUnreadCount]);

  return unreadCount;
}
