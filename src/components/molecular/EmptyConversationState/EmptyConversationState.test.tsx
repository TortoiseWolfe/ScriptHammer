import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyConversationState from './EmptyConversationState';

describe('EmptyConversationState', () => {
  const defaultProps = {
    onOpenSidebar: vi.fn(),
  };

  it('renders heading text', () => {
    render(<EmptyConversationState {...defaultProps} />);
    expect(screen.getByText('Select a conversation')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<EmptyConversationState {...defaultProps} />);
    expect(
      screen.getByText('Choose a conversation from the sidebar to start messaging')
    ).toBeInTheDocument();
  });

  it('calls onOpenSidebar when button clicked', () => {
    const onOpenSidebar = vi.fn();
    render(<EmptyConversationState onOpenSidebar={onOpenSidebar} />);
    fireEvent.click(screen.getByRole('button', { name: /open sidebar/i }));
    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
  });

  it('button has md:hidden class (mobile only)', () => {
    render(<EmptyConversationState {...defaultProps} />);
    const button = screen.getByRole('button', { name: /open sidebar/i });
    expect(button.className).toContain('md:hidden');
  });
});
