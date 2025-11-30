'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  Profiler,
  ProfilerOnRenderCallback,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import MessageBubble from '@/components/atomic/MessageBubble';
import TypingIndicator from '@/components/atomic/TypingIndicator';
import type { DecryptedMessage } from '@/types/messaging';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:molecular:MessageThread');

/** Conditional Profiler wrapper - only active in development (FR-013) */
const ProfilerWrapper =
  process.env.NODE_ENV === 'development'
    ? Profiler
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

export interface MessageThreadProps {
  /** Array of decrypted messages */
  messages: DecryptedMessage[];
  /** Callback to load more messages (infinite scroll) */
  onLoadMore?: () => void;
  /** Whether more messages are available */
  hasMore?: boolean;
  /** Loading state for pagination */
  loading?: boolean;
  /** Whether other user is typing */
  isTyping?: boolean;
  /** Name of user who is typing */
  typingUserName?: string;
  /** Callback when message is edited (Phase 6) */
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  /** Callback when message is deleted (Phase 6) */
  onDeleteMessage?: (messageId: string) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

/** Minimum messages for virtual scrolling (performance threshold) */
const VIRTUAL_SCROLL_THRESHOLD = 100;
/** Distance from bottom (px) to show "jump to bottom" button */
const SHOW_JUMP_BUTTON_THRESHOLD = 500;

/**
 * MessageThread component
 * Tasks: T074-T076, T115 (integrated TypingIndicator), T157-T164 (Phase 8: Virtual Scrolling)
 *
 * Features:
 * - Render MessageBubble array with virtual scrolling for 100+ messages
 * - Auto-scroll to bottom on new message with scroll restoration
 * - Pagination support (infinite scroll upwards)
 * - "Jump to bottom" button with smooth scrolling
 * - Typing indicator for other user
 * - Performance monitoring with React Profiler
 * - Dynamic height estimation for messages
 *
 * @category molecular
 */
export default function MessageThread({
  messages,
  onLoadMore,
  hasMore = false,
  loading = false,
  isTyping = false,
  typingUserName = 'User',
  onEditMessage,
  onDeleteMessage,
  className = '',
}: MessageThreadProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastMessageRef = useRef<string | null>(null);
  const previousScrollHeight = useRef<number>(0);
  const shouldAutoScroll = useRef<boolean>(true);

  // Determine whether to use virtual scrolling
  const useVirtualScrolling = messages.length >= VIRTUAL_SCROLL_THRESHOLD;

  // Dynamic height estimation: ~100px for text, ~200px for messages with images
  const estimateSize = useCallback(
    (index: number) => {
      const message = messages[index];
      // Check if message has image attachments (future enhancement)
      // For now, use consistent height
      return message?.content?.length > 200 ? 120 : 80;
    },
    [messages]
  );

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5, // Render 5 extra items above/below viewport
    enabled: useVirtualScrolling,
  });

  // Performance monitoring callback
  const onRenderCallback: ProfilerOnRenderCallback = useCallback(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      // Log render time for large conversations (>500 messages)
      if (messages.length > 500) {
        logger.info('MessageThread performance metrics', {
          messageCount: messages.length,
          phase,
          actualDuration: `${actualDuration.toFixed(2)}ms`,
          baseDuration: `${baseDuration.toFixed(2)}ms`,
          virtualScrolling: useVirtualScrolling,
        });
      }
    },
    [messages.length, useVirtualScrolling]
  );

  // Memoized callbacks for edit/delete
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      return onEditMessage?.(messageId, newContent) ?? Promise.resolve();
    },
    [onEditMessage]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      return onDeleteMessage?.(messageId) ?? Promise.resolve();
    },
    [onDeleteMessage]
  );

  // Scroll restoration: save position before new messages arrive
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    if (loading && hasMore) {
      // Save current scroll height before pagination
      previousScrollHeight.current = parent.scrollHeight;
    }
  }, [loading, hasMore]);

  // Restore scroll position after pagination
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent || !previousScrollHeight.current) return;

    const newScrollHeight = parent.scrollHeight;
    const heightDifference = newScrollHeight - previousScrollHeight.current;

    if (heightDifference > 0) {
      // Restore scroll position to maintain view
      parent.scrollTop = parent.scrollTop + heightDifference;
      previousScrollHeight.current = 0;
    }
  }, [messages]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessageId = messages[messages.length - 1].id;

      // Only auto-scroll if this is a truly new message AND user is near bottom
      if (
        latestMessageId !== lastMessageRef.current &&
        lastMessageRef.current !== null &&
        shouldAutoScroll.current
      ) {
        scrollToBottom(true);
      }

      lastMessageRef.current = latestMessageId;
    }
    // scrollToBottom is stable (useCallback with stable deps), safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Check if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const { scrollTop, scrollHeight, clientHeight } = parent;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // Show scroll button if more than threshold from bottom
    const shouldShowButton = distanceFromBottom > SHOW_JUMP_BUTTON_THRESHOLD;
    setShowScrollButton(shouldShowButton);

    // Update auto-scroll behavior
    shouldAutoScroll.current = distanceFromBottom < 100;

    // Load more when scrolling to top
    if (scrollTop < 100 && hasMore && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  // Scroll to bottom with smooth animation
  const scrollToBottom = useCallback(
    (smooth = false) => {
      if (useVirtualScrolling) {
        virtualizer.scrollToIndex(messages.length - 1, {
          align: 'end',
          behavior: smooth ? 'smooth' : 'auto',
        });
      } else {
        const parent = parentRef.current;
        if (parent) {
          parent.scrollTo({
            top: parent.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto',
          });
        }
      }
      shouldAutoScroll.current = true;
    },
    [useVirtualScrolling, virtualizer, messages.length]
  );

  // Get virtual items for rendering
  const virtualItems = useVirtualScrolling
    ? virtualizer.getVirtualItems()
    : null;

  // Render virtual or standard list
  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-base-content opacity-60">
            No messages yet. Send the first one!
          </p>
        </div>
      );
    }

    if (useVirtualScrolling && virtualItems) {
      // Virtual scrolling: only render visible items
      return (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={message.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="px-4 py-2">
                  <MessageBubble
                    message={message}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                  />
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div
              style={{
                position: 'absolute',
                top: virtualizer.getTotalSize(),
                left: 0,
                width: '100%',
              }}
            >
              <div className="px-4 py-2">
                <TypingIndicator show={isTyping} userName={typingUserName} />
              </div>
            </div>
          )}
        </div>
      );
    }

    // Standard rendering for < 100 messages
    return (
      <div className="space-y-4 p-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
          />
        ))}
        <TypingIndicator show={isTyping} userName={typingUserName} />
      </div>
    );
  };

  return (
    <ProfilerWrapper id="MessageThread" onRender={onRenderCallback}>
      <div className={`relative h-full${className ? ` ${className}` : ''}`}>
        <div
          ref={parentRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto"
          data-testid="message-thread"
          style={{ overscrollBehavior: 'contain' }}
        >
          {loading && hasMore && (
            <div
              className="flex justify-center py-4"
              data-testid="pagination-loader"
            >
              <span className="loading loading-spinner loading-sm"></span>
              <span className="text-base-content ml-2 text-sm opacity-60">
                Loading older messages...
              </span>
            </div>
          )}

          {renderMessages()}
        </div>

        {showScrollButton && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="btn btn-circle btn-primary absolute right-4 bottom-4 z-10 min-h-11 min-w-11 shadow-lg"
            aria-label="Jump to bottom"
            data-testid="jump-to-bottom"
          >
            ↓
          </button>
        )}
      </div>
    </ProfilerWrapper>
  );
}
