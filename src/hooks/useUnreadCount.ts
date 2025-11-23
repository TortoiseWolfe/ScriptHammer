import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
        // Get all conversations for this user
        const { data: conversations } = await (supabase as any)
          .from('conversations')
          .select('id')
          .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`);

        if (!conversations || conversations.length === 0) {
          setUnreadCount(0);
          return;
        }

        const conversationIds = conversations.map((c: any) => c.id);

        // Count unread messages (messages where read_at is null and sender is NOT current user)
        const { count } = await (supabase as any)
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .neq('sender_id', user.id)
          .is('read_at', null);

        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
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
