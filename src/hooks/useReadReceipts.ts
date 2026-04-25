'use client';

/**
 * useReadReceipts Hook
 * Task: T118
 *
 * Automatically marks messages as read when the conversation is viewed.
 * Uses Intersection Observer to detect when messages enter viewport.
 *
 * Features:
 * - Marks unread messages as read when they become visible
 * - Batches read receipt updates for performance
 * - Debounces updates to avoid excessive API calls
 * - Only marks messages from other users (not own messages)
 */

import { useEffect, useRef, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { messageService } from '@/services/messaging/message-service';
import type { DecryptedMessage } from '@/types/messaging';

const logger = createLogger('hooks:readReceipts');

interface UseReadReceiptsOptions {
  /** Array of messages in the conversation */
  messages: DecryptedMessage[];
  /** Current user ID */
  userId: string;
  /** Conversation ID */
  conversationId: string;
  /** Whether the conversation is currently visible (window focused) */
  isVisible?: boolean;
}

export function useReadReceipts({
  messages,
  userId,
  conversationId,
  isVisible = true,
}: UseReadReceiptsOptions): void {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pendingReadRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Mark messages as read (batched)
   */
  const markMessagesAsRead = useCallback(async () => {
    if (pendingReadRef.current.size === 0) return;

    const messageIds = Array.from(pendingReadRef.current);
    pendingReadRef.current.clear();

    logger.debug('Marking messages as read', { messageIds });
    try {
      await messageService.markAsRead(messageIds);
      logger.debug('Successfully marked messages as read', {
        count: messageIds.length,
      });
    } catch (error) {
      logger.error('Failed to mark messages as read', { error, messageIds });
      // Re-add to pending if failed (retry on next batch)
      messageIds.forEach((id) => pendingReadRef.current.add(id));
    }
  }, []);

  /**
   * Debounced batch update
   */
  const scheduleReadUpdate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      markMessagesAsRead();
      timeoutRef.current = null;
    }, 500); // 500ms debounce
  }, [markMessagesAsRead]);

  // Mirror current messages into a ref so handleIntersection can read the
  // latest array without depending on it. Without this, every new incoming
  // message gave handleIntersection a fresh identity → the observer effect
  // re-ran → observer.disconnect() → new observer → re-observe-all on every
  // new message in an active conversation, producing spurious mark-as-read
  // calls for every visible message.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * Handle message entering viewport
   */
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (!isVisible) return;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const messageId = entry.target.getAttribute('data-message-id');
          if (messageId) {
            const message = messagesRef.current.find((m) => m.id === messageId);

            // Only mark unread, non-deleted messages from other users.
            // A [Message deleted] placeholder scrolling into view isn't a
            // read event — it has no content to read.
            if (
              message &&
              !message.read_at &&
              !message.deleted &&
              message.sender_id !== userId
            ) {
              pendingReadRef.current.add(messageId);
              scheduleReadUpdate();
            }
          }
        }
      });
    },
    [userId, isVisible, scheduleReadUpdate]
  );

  /**
   * Setup Intersection Observer
   */
  useEffect(() => {
    if (!isVisible) return;

    // Create observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null, // viewport
      rootMargin: '0px',
      threshold: 0.5, // 50% of message must be visible
    });

    // Observe all message elements
    const messageElements = document.querySelectorAll('[data-message-id]');
    messageElements.forEach((element) => {
      observerRef.current?.observe(element);
    });

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // Flush pending updates on unmount
      // Intentionally accessing ref at cleanup time to flush pending reads
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (pendingReadRef.current.size > 0) {
        markMessagesAsRead();
      }

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // Re-run on messages.length so new [data-message-id] elements get
    // observed when they mount. We intentionally use .length instead of
    // the full `messages` array so unrelated updates (read_at flag flips,
    // edit_history, etc.) don't tear down + rebuild the observer.
    // handleIntersection itself is stable now (reads `messages` via ref).
  }, [messages.length, isVisible, handleIntersection, markMessagesAsRead]);

  /**
   * Handle window visibility changes
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Flush pending updates when window becomes hidden
      if (document.hidden && pendingReadRef.current.size > 0) {
        markMessagesAsRead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [markMessagesAsRead]);
}
