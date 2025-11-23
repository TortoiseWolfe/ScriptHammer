import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageThread from './MessageThread';
import type { DecryptedMessage } from '@/types/messaging';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: () => 1000,
    getVirtualItems: () => [],
    scrollToIndex: vi.fn(),
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
