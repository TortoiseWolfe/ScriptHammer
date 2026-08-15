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
import QueuedMessageBubble from '@/components/atomic/QueuedMessageBubble';
import TypingIndicator from '@/components/atomic/TypingIndicator';
import type { DecryptedMessage, PendingMessage } from '@/types/messaging';
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
  /** Pending (queued, not-yet-synced) outgoing messages — rendered after synced messages */
  pendingMessages?: PendingMessage[];
  /** Retry callback for a single failed queued message */
  onRetryPending?: (id: string) => Promise<void>;
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
  pendingMessages = [],
  onRetryPending,
  className = '',
}: MessageThreadProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastMessageRef = useRef<string | null>(null);
  const previousScrollHeight = useRef<number>(0);
  const shouldAutoScroll = useRef<boolean>(true);

  /**
   * An explicit "take me to the newest message" that has not been satisfied yet (#756).
   *
   * Separate from `shouldAutoScroll` on purpose: that one is recomputed from position on
   * every scroll event, including the jump's own animation frames, so it is false for
   * most of the journey and cannot represent an intent that has to outlive the trip.
   */
  const pendingJumpRef = useRef<boolean>(false);

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
        // Read scrollToBottom from the ref so we always invoke the latest
        // version (which may have switched between virtual + non-virtual
        // paths since this effect first mounted).
        scrollToBottomRef.current(true);
      }

      lastMessageRef.current = latestMessageId;
    }
  }, [messages]);

  /**
   * Whether the jump button belongs on screen, given where the thread sits RIGHT NOW.
   *
   * This is a pure function of layout, so it has to run whenever layout changes — not
   * only when the user scrolls. It used to live inside the scroll handler alone, and
   * that was a real defect: open a conversation, scroll up before the messages finish
   * rendering, and the button's visibility was decided against an empty list (a 404px
   * container, distanceFromBottom 0 → hidden). The messages then rendered, the thread
   * became 3136px with 2798px below the fold, and nothing revisited the decision. The
   * button stayed hidden until the user scrolled again — exactly when they had most
   * reason to want it.
   *
   * Measured, not inferred: T009 failed about one run in ten on firefox this way, and
   * the instrumented run showed `bubbles: 0` at the moment the state was computed.
   */
  const syncJumpButton = useCallback(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const { scrollTop, scrollHeight, clientHeight } = parent;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    setShowScrollButton(distanceFromBottom > SHOW_JUMP_BUTTON_THRESHOLD);
  }, []);

  // Check if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const parent = parentRef.current;
    if (!parent) return;

    syncJumpButton();

    const { scrollTop, scrollHeight, clientHeight } = parent;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // DELIBERATELY SCROLL-ONLY, unlike the button above. This records user INTENT —
    // "am I following the live conversation?" — and only the user moving the scroll
    // expresses that. Content growing underneath someone does not mean they changed
    // their mind, so recomputing it on resize would silently drop people out of
    // follow mode whenever a tall message arrived.
    shouldAutoScroll.current = distanceFromBottom < 100;

    // Load more when scrolling to top
    if (scrollTop < 100 && hasMore && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [syncJumpButton, hasMore, loading, onLoadMore]);

  /**
   * Recompute the button when the thread RESIZES, not just when it scrolls.
   *
   * Covers every way the distance-from-bottom can change without a scroll event:
   * messages arriving or decrypting, images and fonts loading, the viewport changing,
   * the virtualizer re-measuring rows.
   */
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      syncJumpButton();

      // HOLD THE BOTTOM WHILE THE CONTENT IS STILL ARRIVING (#756).
      //
      // "Jump to the bottom" is an intent, not a coordinate, and the old code treated it
      // as a coordinate: it scrolled to whatever `scrollHeight` happened to be at the
      // instant of the click. Click it while a page of older messages is still loading —
      // which is the normal case, because reaching the top is what STARTED that load —
      // and the target is stale before the animation ends. Measured: the reader is left
      // 1934px short, and nothing re-aims, because prepending older messages does not
      // change the newest message id so the auto-scroll effect never fires.
      //
      // Re-aiming here converges: scrolling changes position, not size, so this cannot
      // feed itself. It stops as soon as the reader takes over, below.
      if (pendingJumpRef.current) scrollToBottomRef.current?.(false);
    });
    observer.observe(parent);
    // The container's own box rarely changes; the CONTENT's height is what moves when
    // messages land, so observe the children too.
    //
    // ALL of them, not `firstElementChild`: while a page is loading the first child is
    // the pagination loader, so watching only that one would miss the very growth this
    // exists to notice. Re-subscribed when the content changes, because the children are
    // replaced on render.
    Array.from(parent.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [syncJumpButton, messages.length, loading]);

  /**
   * The reader taking over cancels the pending jump.
   *
   * Deliberately NOT the `scroll` event: the jump's own animation emits those, so using
   * them would cancel the intent the moment it started acting on it. These three are the
   * ways a person actually moves a thread themselves.
   */
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const release = () => {
      pendingJumpRef.current = false;
    };
    parent.addEventListener('wheel', release, { passive: true });
    parent.addEventListener('touchstart', release, { passive: true });
    parent.addEventListener('keydown', release);
    // Dragging the scrollbar emits neither wheel nor touch.
    parent.addEventListener('mousedown', release);
    return () => {
      parent.removeEventListener('wheel', release);
      parent.removeEventListener('touchstart', release);
      parent.removeEventListener('keydown', release);
      parent.removeEventListener('mousedown', release);
    };
  }, []);

  // Bind handleScroll as a native DOM event listener instead of via React's
  // `onScroll` JSX prop. Reason: React's synthetic onScroll does not reliably
  // fire on WebKit when test code dispatches a programmatic
  // `dispatchEvent(new Event('scroll', { bubbles: true }))` after assigning
  // `scrollTop`. Native `addEventListener('scroll', ...)` does fire
  // deterministically across chromium, firefox, and webkit. See the round-10
  // E2E flake mitigation in CLAUDE.md "CI & E2E Stability" section.
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    parent.addEventListener('scroll', handleScroll, { passive: true });
    return () => parent.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Scroll to bottom with smooth animation
  const scrollToBottom = useCallback(
    (smooth = false) => {
      if (useVirtualScrolling) {
        virtualizer.scrollToIndex(messages.length - 1, {
          align: 'end',
          behavior: 'auto',
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

  // Mirror current scrollToBottom into a ref so the auto-scroll effect can
  // call it without depending on it. Without this, crossing the virtual-
  // scrolling threshold (>100 messages) gives scrollToBottom a fresh
  // identity, but the auto-scroll effect held the pre-virtual closure —
  // so new messages stopped auto-scrolling after the threshold.
  const scrollToBottomRef = useRef(scrollToBottom);
  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom]);

  // Get virtual items for rendering
  const virtualItems = useVirtualScrolling
    ? virtualizer.getVirtualItems()
    : null;

  // Queued bubbles appended after the synced list. Memoised so the map
  // callback identity is stable (pendingMessages is usually short).
  const renderPendingBubbles = useMemo(
    () =>
      pendingMessages.map((pm) => (
        <QueuedMessageBubble
          key={pm.id}
          message={pm}
          onRetry={onRetryPending}
        />
      )),
    [pendingMessages, onRetryPending]
  );

  // Render virtual or standard list
  const renderMessages = () => {
    if (messages.length === 0 && pendingMessages.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-base-content">
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
          {(pendingMessages.length > 0 || isTyping) && (
            <div
              style={{
                position: 'absolute',
                top: virtualizer.getTotalSize(),
                left: 0,
                width: '100%',
              }}
            >
              <div className="space-y-4 px-4 py-2">
                {renderPendingBubbles}
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
        {renderPendingBubbles}
        <TypingIndicator show={isTyping} userName={typingUserName} />
      </div>
    );
  };

  return (
    <ProfilerWrapper id="MessageThread" onRender={onRenderCallback}>
      <div
        className={`relative h-full${className ? ` ${className}` : ''}`}
        data-show-scroll-button={showScrollButton ? 'true' : 'false'}
      >
        <div
          ref={parentRef}
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
              <span className="text-base-content ml-2 text-sm">
                Loading older messages...
              </span>
            </div>
          )}

          {renderMessages()}
        </div>

        {showScrollButton && (
          <button
            type="button"
            onClick={() => {
              // The intent outlives the scroll: content may still be arriving.
              pendingJumpRef.current = true;
              scrollToBottom(true);
            }}
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
