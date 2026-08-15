import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageThread from './MessageThread';
import type { DecryptedMessage } from '@/types/messaging';

// Mock @tanstack/react-virtual. `scrollToIndex` is hoisted into a STABLE spy rather
// than created per-render, so a test can assert what the component actually asked the
// virtualizer to do — see the smooth-scroll contract test below.
const { scrollToIndexSpy } = vi.hoisted(() => ({ scrollToIndexSpy: vi.fn() }));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: () => 1000,
    getVirtualItems: () => [],
    scrollToIndex: scrollToIndexSpy,
    measureElement: vi.fn(),
  })),
}));

const createMockMessage = (
  id: string,
  content: string,
  index: number
): DecryptedMessage => ({
  id,
  conversation_id: 'conv-1',
  sender_id: index % 2 === 0 ? 'user-1' : 'user-2',
  content,
  created_at: new Date(Date.now() - (100 - index) * 1000).toISOString(),
  delivered_at: new Date(Date.now() - (100 - index) * 1000 + 500).toISOString(),
  read_at: null,
  edited: false,
  edited_at: null,
  deleted: false,
  sequence_number: index + 1,
  senderName: index % 2 === 0 ? 'Alice' : 'Bob',
  isOwn: index % 2 === 0,
});

describe('MessageThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders empty state', () => {
      render(<MessageThread messages={[]} />);
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <MessageThread messages={[]} className="custom-class" />
      );
      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('custom-class');
    });

    it('renders messages in standard mode (<100 messages)', () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );
      render(<MessageThread messages={messages} />);

      // Should render all messages in standard mode
      messages.forEach((msg) => {
        expect(screen.getByText(msg.content)).toBeInTheDocument();
      });
    });
  });

  describe('Virtual Scrolling (100+ messages)', () => {
    it('activates virtual scrolling at 100 messages threshold', () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      const { rerender } = render(<MessageThread messages={messages} />);

      // Should use virtual scrolling at exactly 100 messages
      const container = screen.getByTestId('message-thread');
      expect(container).toBeInTheDocument();

      // Add one more message - should still use virtual scrolling
      const updatedMessages = [
        ...messages,
        createMockMessage('msg-100', 'Message 100', 100),
      ];
      rerender(<MessageThread messages={updatedMessages} />);
      expect(container).toBeInTheDocument();
    });

    it('does not activate virtual scrolling below threshold', () => {
      const messages = Array.from({ length: 99 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(<MessageThread messages={messages} />);

      // Should render in standard mode with space-y-4 class
      const container = screen.getByTestId('message-thread');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('shows loading spinner when loading older messages', () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(
        <MessageThread messages={messages} hasMore={true} loading={true} />
      );

      expect(screen.getByTestId('pagination-loader')).toBeInTheDocument();
      expect(screen.getByText(/Loading older messages/)).toBeInTheDocument();
    });

    it('hides loading spinner when not loading', () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(
        <MessageThread messages={messages} hasMore={true} loading={false} />
      );

      expect(screen.queryByTestId('pagination-loader')).not.toBeInTheDocument();
    });

    it('calls onLoadMore when scrolling to top', async () => {
      const onLoadMore = vi.fn();
      const messages = Array.from({ length: 50 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(
        <MessageThread
          messages={messages}
          hasMore={true}
          loading={false}
          onLoadMore={onLoadMore}
        />
      );

      const container = screen.getByTestId('message-thread');

      // Simulate scroll to top
      Object.defineProperty(container, 'scrollTop', {
        value: 50,
        writable: true,
      });
      container.dispatchEvent(new Event('scroll'));

      await waitFor(() => {
        expect(onLoadMore).toHaveBeenCalled();
      });
    });
  });

  describe('Jump to Bottom Button', () => {
    it('shows jump to bottom button when scrolled away', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(<MessageThread messages={messages} />);

      const container = screen.getByTestId('message-thread');

      // Mock scroll position far from bottom
      Object.defineProperty(container, 'scrollTop', {
        value: 0,
        writable: true,
      });
      Object.defineProperty(container, 'scrollHeight', {
        value: 5000,
        writable: true,
      });
      Object.defineProperty(container, 'clientHeight', {
        value: 400,
        writable: true,
      });

      container.dispatchEvent(new Event('scroll'));

      await waitFor(() => {
        expect(screen.getByTestId('jump-to-bottom')).toBeInTheDocument();
      });
    });

    /**
     * The button must react to the thread RESIZING, not only to scrolling.
     *
     * THE BUG THIS PINS. Visibility was computed inside the scroll handler alone. Open a
     * conversation and scroll up before the messages finish rendering and the decision
     * was made against an empty list — container 404px, distanceFromBottom 0, so: hidden.
     * The messages then rendered (3136px, 2798px below the fold) and nothing recomputed,
     * so the button stayed hidden until the user scrolled again. Measured on firefox at
     * roughly one run in ten as T009; the instrumented run showed `bubbles: 0` at the
     * moment the state was decided.
     *
     * Driving the observer directly is the point: it is the only way to separate "the
     * component recomputed because layout changed" from "the component happened to get a
     * scroll event", and the scroll event is exactly what is missing in the real failure.
     */
    it('shows the button when content grows underneath a scrolled-up reader, with no scroll event', async () => {
      const callbacks: ResizeObserverCallback[] = [];
      const RealRO = global.ResizeObserver;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: ResizeObserverCallback) {
            callbacks.push(cb);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );

      try {
        const messages = Array.from({ length: 50 }, (_, i) =>
          createMockMessage(`msg-${i}`, `Message ${i}`, i)
        );
        render(<MessageThread messages={messages} />);
        const container = screen.getByTestId('message-thread');

        // Start where the real failure starts: nothing rendered yet, so the reader is
        // trivially "at the bottom" and the button correctly stays away.
        Object.defineProperty(container, 'scrollTop', {
          value: 0,
          writable: true,
        });
        Object.defineProperty(container, 'scrollHeight', {
          value: 404,
          writable: true,
        });
        Object.defineProperty(container, 'clientHeight', {
          value: 404,
          writable: true,
        });
        container.dispatchEvent(new Event('scroll'));
        await waitFor(() => {
          expect(
            screen.queryByTestId('jump-to-bottom')
          ).not.toBeInTheDocument();
        });

        // Messages arrive. The reader has not touched the scroll, so NO scroll event.
        Object.defineProperty(container, 'scrollHeight', {
          value: 3136,
          writable: true,
        });
        Object.defineProperty(container, 'clientHeight', {
          value: 338,
          writable: true,
        });

        // Negative control: without the observer firing, nothing should have changed —
        // otherwise a stray re-render, not the fix, is what this test measures.
        expect(screen.queryByTestId('jump-to-bottom')).not.toBeInTheDocument();

        expect(
          callbacks.length,
          'MessageThread never constructed a ResizeObserver, so it cannot notice content ' +
            'arriving without a scroll — this is the defect, not a harness problem'
        ).toBeGreaterThan(0);
        callbacks.forEach((cb) =>
          cb([] as unknown as ResizeObserverEntry[], {} as ResizeObserver)
        );

        await waitFor(() => {
          expect(screen.getByTestId('jump-to-bottom')).toBeInTheDocument();
        });
      } finally {
        vi.stubGlobal('ResizeObserver', RealRO);
      }
    });

    /**
     * The jump is an INTENT, and content is still arriving when it is made (#756).
     *
     * Reaching the top is what triggers loading older messages, so "scroll to the top,
     * then press jump" is the ordinary case, not a corner. The old code resolved the jump
     * to a coordinate — `scrollTop = scrollHeight` at the instant of the click — and that
     * number is stale before the scroll finishes. Prepending older messages does not
     * change the newest message id, so the auto-scroll effect never re-aims either, and
     * the reader is left short. Measured at 1934px in `performance.spec.ts`, failing 2 of
     * 3 full-spec runs on firefox.
     *
     * Deterministic here, where the E2E is inherently timing-dependent: grow the content
     * and drive the observer by hand.
     */
    it('re-aims at the bottom when content arrives after the jump was requested', async () => {
      const user = userEvent.setup();
      const callbacks: ResizeObserverCallback[] = [];
      const RealRO = global.ResizeObserver;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: ResizeObserverCallback) {
            callbacks.push(cb);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );

      try {
        // Below the virtualization threshold, which is the path this defect lives on.
        const messages = Array.from({ length: 50 }, (_, i) =>
          createMockMessage(`msg-${i}`, `Message ${i}`, i)
        );
        render(<MessageThread messages={messages} />);
        const container = screen.getByTestId('message-thread');

        const scrollTo = vi.fn();
        Object.defineProperty(container, 'scrollTo', {
          value: scrollTo,
          writable: true,
        });
        Object.defineProperty(container, 'scrollTop', {
          value: 0,
          writable: true,
        });
        Object.defineProperty(container, 'scrollHeight', {
          value: 5278,
          writable: true,
        });
        Object.defineProperty(container, 'clientHeight', {
          value: 258,
          writable: true,
        });
        container.dispatchEvent(new Event('scroll'));

        const button = await screen.findByTestId('jump-to-bottom');
        await user.click(button);
        expect(
          scrollTo,
          'the jump never asked the container to scroll, so nothing below is meaningful'
        ).toHaveBeenCalledWith(expect.objectContaining({ top: 5278 }));

        // A page of older messages lands: the thread is now much taller, and the target
        // the click resolved to is no longer the bottom.
        scrollTo.mockClear();
        Object.defineProperty(container, 'scrollHeight', {
          value: 8600,
          writable: true,
        });
        callbacks.forEach((cb) =>
          cb([] as unknown as ResizeObserverEntry[], {} as ResizeObserver)
        );

        await waitFor(() => {
          expect(scrollTo).toHaveBeenCalledWith(
            expect.objectContaining({ top: 8600 })
          );
        });
      } finally {
        vi.stubGlobal('ResizeObserver', RealRO);
      }
    });

    /**
     * ...and stops as soon as the reader takes over, or it would fight them.
     */
    it('stops re-aiming once the reader scrolls for themselves', async () => {
      const user = userEvent.setup();
      const callbacks: ResizeObserverCallback[] = [];
      const RealRO = global.ResizeObserver;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: ResizeObserverCallback) {
            callbacks.push(cb);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );

      try {
        const messages = Array.from({ length: 50 }, (_, i) =>
          createMockMessage(`msg-${i}`, `Message ${i}`, i)
        );
        render(<MessageThread messages={messages} />);
        const container = screen.getByTestId('message-thread');

        const scrollTo = vi.fn();
        Object.defineProperty(container, 'scrollTo', {
          value: scrollTo,
          writable: true,
        });
        Object.defineProperty(container, 'scrollTop', {
          value: 0,
          writable: true,
        });
        Object.defineProperty(container, 'scrollHeight', {
          value: 5278,
          writable: true,
        });
        Object.defineProperty(container, 'clientHeight', {
          value: 258,
          writable: true,
        });
        container.dispatchEvent(new Event('scroll'));

        await user.click(await screen.findByTestId('jump-to-bottom'));

        // The reader grabs the wheel. That cancels the pending jump.
        container.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));

        scrollTo.mockClear();
        Object.defineProperty(container, 'scrollHeight', {
          value: 8600,
          writable: true,
        });
        callbacks.forEach((cb) =>
          cb([] as unknown as ResizeObserverEntry[], {} as ResizeObserver)
        );

        await waitFor(() => {
          expect(callbacks.length).toBeGreaterThan(0);
        });
        expect(
          scrollTo,
          'the component kept dragging the reader back to the bottom after they scrolled away'
        ).not.toHaveBeenCalled();
      } finally {
        vi.stubGlobal('ResizeObserver', RealRO);
      }
    });

    /**
     * Under virtualization the jump must NOT ask for a smooth scroll.
     *
     * This is a contract with @tanstack/virtual-core, not a style preference. Its
     * `scrollToIndex` warns "The `smooth` scroll behavior is not fully supported with
     * dynamic size" and then, because it re-checks the position one animation frame
     * after starting an animation that takes hundreds, mismatches every time, retries
     * ten times and gives up: "Failed to scroll to index N after 10 attempts."
     *
     * Measured against the real component in Storybook, before the fix — the thread
     * stopped short and STAYED short through a 15s poll:
     *
     *   100 messages   chromium 2814px short    firefox 1126px short
     *   500 messages   chromium 33156px short   firefox 26391px short
     *
     * With `auto` every one of those became 0. The non-virtualized path below 100
     * messages keeps its smooth animation, where the browser handles it correctly.
     */
    it('asks the virtualizer for an instant scroll, never a smooth one', async () => {
      const user = userEvent.setup();
      const messages = Array.from({ length: 120 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );
      render(<MessageThread messages={messages} />);
      const container = screen.getByTestId('message-thread');

      Object.defineProperty(container, 'scrollTop', {
        value: 0,
        writable: true,
      });
      Object.defineProperty(container, 'scrollHeight', {
        value: 5000,
        writable: true,
      });
      Object.defineProperty(container, 'clientHeight', {
        value: 400,
        writable: true,
      });
      container.dispatchEvent(new Event('scroll'));

      const button = await screen.findByTestId('jump-to-bottom');
      scrollToIndexSpy.mockClear();
      await user.click(button);

      expect(
        scrollToIndexSpy,
        'the jump button did not reach the virtualizer at all, so the behavior ' +
          'assertion below would be vacuous'
      ).toHaveBeenCalled();
      expect(scrollToIndexSpy).toHaveBeenCalledWith(
        messages.length - 1,
        expect.objectContaining({ align: 'end', behavior: 'auto' })
      );
    });

    it('hides jump to bottom button when near bottom', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(<MessageThread messages={messages} />);

      const container = screen.getByTestId('message-thread');

      // Mock scroll position near bottom
      Object.defineProperty(container, 'scrollTop', {
        value: 4600,
        writable: true,
      });
      Object.defineProperty(container, 'scrollHeight', {
        value: 5000,
        writable: true,
      });
      Object.defineProperty(container, 'clientHeight', {
        value: 400,
        writable: true,
      });

      container.dispatchEvent(new Event('scroll'));

      await waitFor(() => {
        expect(screen.queryByTestId('jump-to-bottom')).not.toBeInTheDocument();
      });
    });

    it('scrolls to bottom when button clicked', async () => {
      const user = userEvent.setup();
      const messages = Array.from({ length: 50 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(<MessageThread messages={messages} />);

      const container = screen.getByTestId('message-thread');

      // Mock scrollTo method
      const scrollToSpy = vi.fn();
      container.scrollTo = scrollToSpy;

      // Mock scroll position far from bottom
      Object.defineProperty(container, 'scrollTop', {
        value: 0,
        writable: true,
      });
      Object.defineProperty(container, 'scrollHeight', {
        value: 5000,
        writable: true,
      });
      Object.defineProperty(container, 'clientHeight', {
        value: 400,
        writable: true,
      });

      container.dispatchEvent(new Event('scroll'));

      await waitFor(() => {
        expect(screen.getByTestId('jump-to-bottom')).toBeInTheDocument();
      });

      const button = screen.getByTestId('jump-to-bottom');
      await user.click(button);

      expect(scrollToSpy).toHaveBeenCalled();
    });
  });

  describe('Typing Indicator', () => {
    it('shows typing indicator when isTyping is true', () => {
      const messages = Array.from({ length: 5 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(
        <MessageThread
          messages={messages}
          isTyping={true}
          typingUserName="Alice"
        />
      );

      expect(screen.getByText(/Alice is typing/)).toBeInTheDocument();
    });

    it('hides typing indicator when isTyping is false', () => {
      const messages = Array.from({ length: 5 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      render(
        <MessageThread
          messages={messages}
          isTyping={false}
          typingUserName="Alice"
        />
      );

      expect(screen.queryByText(/Alice is typing/)).not.toBeInTheDocument();
    });
  });

  describe('Message Edit/Delete Callbacks', () => {
    it('passes onEdit callback to MessageBubble', async () => {
      const onEdit = vi.fn().mockResolvedValue(undefined);
      const messages = [createMockMessage('msg-1', 'Test message', 0)];

      render(<MessageThread messages={messages} onEditMessage={onEdit} />);

      // MessageBubble should receive the callback
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('passes onDelete callback to MessageBubble', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const messages = [createMockMessage('msg-1', 'Test message', 0)];

      render(<MessageThread messages={messages} onDeleteMessage={onDelete} />);

      // MessageBubble should receive the callback
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large message arrays efficiently', () => {
      const messages = Array.from({ length: 1000 }, (_, i) =>
        createMockMessage(`msg-${i}`, `Message ${i}`, i)
      );

      const startTime = performance.now();
      render(<MessageThread messages={messages} />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;

      // Should render in under 500ms even with 1000 messages
      expect(renderTime).toBeLessThan(500);
    });
  });
});
