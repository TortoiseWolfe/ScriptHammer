import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationView, { resolveParticipantName } from './ConversationView';

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

  it('polls getMessageHistory on a 10s interval (#57 cross-window delivery)', async () => {
    vi.useFakeTimers();
    try {
      const { messageService } = await import(
        '@/services/messaging/message-service'
      );
      vi.mocked(messageService.getMessageHistory).mockClear();

      render(<ConversationView conversationId="conv-poll" />);

      // Initial mount fires one fetch. Drain microtasks so the
      // loadConversationInfo().then(loadMessages()) chain resolves.
      await vi.waitFor(() => {
        expect(messageService.getMessageHistory).toHaveBeenCalledTimes(1);
      });

      // Advance 10s — polling tick fires → second fetch.
      await vi.advanceTimersByTimeAsync(10_000);
      await vi.waitFor(() => {
        expect(messageService.getMessageHistory).toHaveBeenCalledTimes(2);
      });

      // Another 10s → third fetch.
      await vi.advanceTimersByTimeAsync(10_000);
      await vi.waitFor(() => {
        expect(messageService.getMessageHistory).toHaveBeenCalledTimes(3);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips polling when document is hidden', async () => {
    vi.useFakeTimers();
    const hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      const { messageService } = await import(
        '@/services/messaging/message-service'
      );
      vi.mocked(messageService.getMessageHistory).mockClear();

      render(<ConversationView conversationId="conv-hidden" />);

      // Initial mount fetch always runs (document.hidden gate is on the
      // poll, not the initial load).
      await vi.waitFor(() => {
        expect(messageService.getMessageHistory).toHaveBeenCalledTimes(1);
      });

      // Tick past several poll intervals — none should fetch because hidden.
      await vi.advanceTimersByTimeAsync(30_000);
      expect(messageService.getMessageHistory).toHaveBeenCalledTimes(1);
    } finally {
      hiddenSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('resolveParticipantName (#30 fix #5)', () => {
  it('returns Unknown User on a query error (transient — do not mislabel)', () => {
    expect(resolveParticipantName(null, true)).toBe('Unknown User');
    expect(resolveParticipantName({ display_name: 'Ada' }, true)).toBe(
      'Unknown User'
    );
  });

  it('returns Deleted User when the profile row is null (no error)', () => {
    expect(resolveParticipantName(null, false)).toBe('Deleted User');
  });

  it('prefers display_name, then username, for a present profile', () => {
    expect(
      resolveParticipantName({ display_name: 'Ada', username: 'ada99' }, false)
    ).toBe('Ada');
    expect(
      resolveParticipantName({ display_name: null, username: 'ada99' }, false)
    ).toBe('ada99');
    expect(
      resolveParticipantName({ display_name: '', username: '' }, false)
    ).toBe('Unknown User');
  });
});
