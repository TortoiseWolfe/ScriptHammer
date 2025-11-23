import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import ConversationListItem from './ConversationListItem';
import type { UserProfile } from '@/types/messaging';

expect.extend(toHaveNoViolations);

const mockParticipant: UserProfile = {
  id: 'user-123',
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
};

describe('ConversationListItem Accessibility', () => {
  it('should not have any automatically detectable accessibility issues', async () => {
    const { container } = render(
      <ConversationListItem
        conversationId="conversation-123"
        participant={mockParticipant}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard accessible', async () => {
    const { container } = render(
      <ConversationListItem
        conversationId="conversation-123"
        participant={mockParticipant}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', async () => {
    const { container } = render(
      <ConversationListItem
        conversationId="conversation-123"
        participant={mockParticipant}
        unreadCount={5}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
