import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from './MessageBubble';
import type { DecryptedMessage } from '@/types/messaging';

const mockMessage: DecryptedMessage = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  content: 'Hello, world!',
  sequence_number: 1,
  deleted: false,
  edited: false,
  edited_at: null,
  delivered_at: null,
  read_at: null,
  created_at: new Date().toISOString(),
  isOwn: true,
  senderName: 'Test User',
};

describe('MessageBubble', () => {
  it('renders message content', () => {
    render(<MessageBubble message={mockMessage} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<MessageBubble message={mockMessage} className="custom-class" />);
    const bubble = screen.getByTestId('message-bubble');
    expect(bubble.className).toContain('custom-class');
  });

  it('shows sender name', () => {
    render(<MessageBubble message={mockMessage} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
