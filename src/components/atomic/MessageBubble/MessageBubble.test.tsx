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

const createMessage = (content: string): DecryptedMessage => ({
  ...mockMessage,
  content,
});

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

  /**
   * Markdown Rendering Tests (Feature 008)
   * Tests for FR-003 through FR-009: Markdown parsing in messages
   */
  describe('markdown rendering', () => {
    it('renders **bold** as <strong>', () => {
      render(
        <MessageBubble message={createMessage('This is **bold** text')} />
      );
      const strong = screen.getByText('bold');
      expect(strong.tagName).toBe('STRONG');
    });

    it('renders *italic* as <em>', () => {
      render(
        <MessageBubble message={createMessage('This is *italic* text')} />
      );
      const em = screen.getByText('italic');
      expect(em.tagName).toBe('EM');
    });

    it('renders `code` as <code>', () => {
      render(<MessageBubble message={createMessage('This is `code` text')} />);
      const code = screen.getByText('code');
      expect(code.tagName).toBe('CODE');
    });

    it('renders mixed markdown correctly', () => {
      render(
        <MessageBubble
          message={createMessage('**bold** and *italic* and `code`')}
        />
      );
      expect(screen.getByText('bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('code').tagName).toBe('CODE');
    });

    it('preserves unmatched **asterisks as plain text', () => {
      render(<MessageBubble message={createMessage('**unclosed asterisks')} />);
      expect(screen.getByText(/\*\*unclosed asterisks/)).toBeInTheDocument();
    });

    it('preserves plain text without markdown unchanged', () => {
      render(<MessageBubble message={createMessage('Plain text message')} />);
      expect(screen.getByText('Plain text message')).toBeInTheDocument();
    });

    it('preserves line breaks in multi-line messages', () => {
      const { container } = render(
        <MessageBubble message={createMessage('Line 1\nLine 2')} />
      );
      // whitespace-pre-wrap preserves newlines
      expect(container.textContent).toContain('Line 1');
      expect(container.textContent).toContain('Line 2');
    });
  });
});
