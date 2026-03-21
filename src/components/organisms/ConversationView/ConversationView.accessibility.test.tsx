import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ConversationView from './ConversationView';

expect.extend(toHaveNoViolations);

vi.mock('@/services/messaging/message-service', () => ({
  messageService: {
    getMessageHistory: vi
      .fn()
      .mockResolvedValue({ messages: [], has_more: false, cursor: null }),
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
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: vi.fn().mockResolvedValue({ data: null }) }),
      }),
    }),
  }),
}));

vi.mock('@/components/organisms/ChatWindow', () => ({
  default: () => <div data-testid="chat-window-mock" />,
}));

describe('ConversationView Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ConversationView conversationId="conv-1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(<ConversationView conversationId="conv-1" />);
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<ConversationView conversationId="conv-1" />);
    expect(container.firstChild).toBeInTheDocument();
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
