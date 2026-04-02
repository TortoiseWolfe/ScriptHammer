import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationView from './ConversationView';

// ConversationView is a state-owning wrapper around ChatWindow. We mock
// the service layer and the ChatWindow organism so tests assert wiring,
// not message rendering (ChatWindow has its own tests).

vi.mock('@/services/messaging/message-service', () => ({
  messageService: {
    getMessageHistory: vi.fn().mockResolvedValue({
      messages: [],
      has_more: false,
      cursor: null,
    }),
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAsDelivered: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/hooks/usePendingMessages', () => ({
  usePendingMessages: () => ({
    pendingMessages: [],
    addPending: vi.fn(),
    retryMessage: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/components/organisms/ChatWindow', () => ({
  default: ({ conversationId }: { conversationId: string }) => (
    <div data-testid="chat-window-mock">conv: {conversationId}</div>
  ),
}));

describe('ConversationView', () => {
  it('renders without crashing', () => {
    render(<ConversationView conversationId="conv-123" />);
    expect(screen.getByTestId('conversation-view')).toBeInTheDocument();
  });

  it('passes conversationId through to ChatWindow', () => {
    render(<ConversationView conversationId="conv-abc" />);
    expect(screen.getByTestId('chat-window-mock')).toHaveTextContent(
      'conv: conv-abc'
    );
  });

  it('applies custom className', () => {
    render(<ConversationView conversationId="conv-1" className="custom-cls" />);
    const el = screen.getByTestId('conversation-view');
    expect(el.className).toContain('custom-cls');
  });

  it('loads message history on mount', async () => {
    const { messageService } = await import(
      '@/services/messaging/message-service'
    );
    render(<ConversationView conversationId="conv-load" />);
    // getMessageHistory is called after loadConversationInfo resolves —
    // give the promise chain a tick.
    await vi.waitFor(() => {
      expect(messageService.getMessageHistory).toHaveBeenCalledWith(
        'conv-load',
        null,
        50
      );
    });
  });
});
