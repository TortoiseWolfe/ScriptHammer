import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatWindow from './ChatWindow';

describe('ChatWindow', () => {
  it('renders chat window', () => {
    const mockOnSend = vi.fn();
    render(
      <ChatWindow
        conversationId="conv-1"
        messages={[]}
        onSendMessage={mockOnSend}
      />
    );
    expect(screen.getByTestId('chat-window')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const mockOnSend = vi.fn();
    render(
      <ChatWindow
        conversationId="conv-1"
        messages={[]}
        onSendMessage={mockOnSend}
        className="custom-class"
      />
    );
    const chatWindow = screen.getByTestId('chat-window');
    expect(chatWindow.className).toContain('custom-class');
  });
});
