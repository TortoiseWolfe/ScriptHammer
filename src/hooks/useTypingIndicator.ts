'use client';

/**
 * useTypingIndicator Hook
 * Task: T113
 *
 * Manages typing indicator state for a conversation.
 * Subscribes to other user's typing status and sends own typing status.
 *
 * Features:
 * - Subscribe to typing indicators via Supabase Realtime
 * - Debounced typing status updates (1s delay)
 * - Automatic expiration after 5s of inactivity
 * - Filters out own typing status (only shows other user)
 *
 * @param conversationId - UUID of the conversation
 * @returns { isTyping, setTyping } - Other user's typing status and function to set own status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeService } from '@/lib/messaging/realtime';
import { createClient } from '@/lib/supabase/client';
import type { UseTypingIndicatorReturn } from '@/types/messaging';

export function useTypingIndicator(
  conversationId: string
): UseTypingIndicatorReturn {
  const [isTyping, setIsTyping] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  /**
   * Get current user ID
   */
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };

    getCurrentUser();
  }, [supabase]);

  /**
   * Set own typing status
   */
  const setTyping = useCallback(
    (typing: boolean) => {
      realtimeService.setTypingStatus(conversationId, typing);
    },
    [conversationId]
  );

  /**
   * Subscribe to typing indicators
   */
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = realtimeService.subscribeToTypingIndicators(
      conversationId,
      (userId, typing) => {
        // Ignore own typing status
        if (userId === currentUserId) return;

        // Update other user's typing status
        setIsTyping(typing);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }

        // Auto-expire typing indicator after 5 seconds
        if (typing) {
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            typingTimeoutRef.current = null;
          }, 5000);
        }
      }
    );

    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, currentUserId]);

  return {
    isTyping,
    setTyping,
  };
}
