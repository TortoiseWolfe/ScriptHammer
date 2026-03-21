import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import EmptyConversationState from './EmptyConversationState';

expect.extend(toHaveNoViolations);

describe('EmptyConversationState accessibility', () => {
  const defaultProps = {
    onOpenSidebar: vi.fn(),
  };

  it('should have no axe violations', async () => {
    const { container } = render(<EmptyConversationState {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has a level 2 heading', () => {
    render(<EmptyConversationState {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Select a conversation');
  });

  it('has an accessible button', () => {
    render(<EmptyConversationState {...defaultProps} />);
    const button = screen.getByRole('button', { name: /open sidebar/i });
    expect(button).toBeInTheDocument();
  });
});
