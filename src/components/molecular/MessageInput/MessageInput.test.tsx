import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  /**
   * Character Count Tests (Feature 008)
   * Tests for FR-001: Character count must display "0 / 10000 characters" when empty
   */
  describe('character count display', () => {
    it('displays "0 / 10000 characters" when input is empty', () => {
      const mockOnSend = vi.fn();
      render(<MessageInput onSend={mockOnSend} />);
      expect(screen.getByText(/0 \/ 10000 characters/)).toBeInTheDocument();
    });

    it('increments character count when typing', () => {
      const mockOnSend = vi.fn();
      render(<MessageInput onSend={mockOnSend} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
      expect(screen.getByText(/5 \/ 10000 characters/)).toBeInTheDocument();
    });

    it('shows 0 when input is cleared', () => {
      const mockOnSend = vi.fn();
      render(<MessageInput onSend={mockOnSend} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText(/0 \/ 10000 characters/)).toBeInTheDocument();
    });
  });
});
