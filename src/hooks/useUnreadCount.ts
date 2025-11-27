import { useState, useEffect } from 'react';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createMessagingClient } from '@/lib/supabase/messaging-client';

const logger = createLogger('hooks:unreadCount');

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
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
          return;
        }

        const conversationIds = conversations.map((c) => c.id);

        // Count unread messages (messages where read_at is null and sender is NOT current user)
        const { count } = await msgClient
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .neq('sender_id', user.id)
          .is('read_at', null);

        setUnreadCount(count || 0);
      } catch (error) {
        logger.error('Failed to fetch unread count', { error });
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return unreadCount;
}
