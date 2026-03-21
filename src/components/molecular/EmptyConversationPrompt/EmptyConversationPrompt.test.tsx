import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyConversationPrompt from './EmptyConversationPrompt';

describe('EmptyConversationPrompt', () => {
  it('renders without crashing', () => {
    render(<EmptyConversationPrompt />);
    expect(
      screen.getByTestId('empty-conversation-prompt')
    ).toBeInTheDocument();
  });

  it('shows the expected heading and body copy', () => {
    render(<EmptyConversationPrompt />);
    expect(
      screen.getByRole('heading', { name: 'Select a conversation' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/choose a conversation from the sidebar/i)
    ).toBeInTheDocument();
  });

  it('hides the Open Sidebar button when no callback is provided', () => {
    render(<EmptyConversationPrompt />);
    expect(
      screen.queryByRole('button', { name: /open sidebar/i })
    ).not.toBeInTheDocument();
  });

  it('renders the Open Sidebar button when callback is provided', () => {
    render(<EmptyConversationPrompt onOpenSidebar={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /open sidebar/i })
    ).toBeInTheDocument();
  });

  it('calls onOpenSidebar when the button is clicked', () => {
    const onOpen = vi.fn();
    render(<EmptyConversationPrompt onOpenSidebar={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /open sidebar/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    render(<EmptyConversationPrompt className="custom-cls" />);
    expect(
      screen.getByTestId('empty-conversation-prompt').className
    ).toContain('custom-cls');
  });
});
