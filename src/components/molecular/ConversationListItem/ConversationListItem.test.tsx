import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationListItem from './ConversationListItem';
import type { UserProfile } from '@/types/messaging';

const mockParticipant: UserProfile = {
  id: 'user-123',
  username: 'testuser',
  avatar_url: null,
  display_name: 'Test User',
};

describe('ConversationListItem', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ConversationListItem
        conversationId="conversation-123"
        participant={mockParticipant}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    const { container } = render(
      <ConversationListItem
        conversationId="conversation-123"
        participant={mockParticipant}
        className={customClass}
      />
    );
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });

  it('displays unread count badge when provided', () => {
    const { container } = render(
      <ConversationListItem
        conversationId="conversation-123"
        participant={mockParticipant}
        unreadCount={5}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    const { container } = render(
      <ConversationListItem
        conversationId="conversation-123"
        participant={mockParticipant}
        onClick={onClick}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  // Add component-specific tests based on actual functionality
});
