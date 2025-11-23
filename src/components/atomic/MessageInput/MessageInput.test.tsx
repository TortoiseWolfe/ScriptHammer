import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageInput from './MessageInput';

describe('MessageInput', () => {
  it('renders input field', () => {
    const mockOnSend = vi.fn();
    render(<MessageInput onSend={mockOnSend} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const mockOnSend = vi.fn();
    const { container } = render(
      <MessageInput onSend={mockOnSend} className="custom-class" />
    );
    const element = container.firstChild as HTMLElement;
    expect(element.className).toContain('custom-class');
  });
});
