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

    /**
     * Edge cases (#36) — spec features/polish/027-ux-polish/spec.md
     * AC-003: warning + remaining count appears within 100 chars of the limit.
     * AC-004: defensive `0` fallback for the count display.
     */
    it('does not show the (remaining) warning while well under the limit', () => {
      const mockOnSend = vi.fn();
      render(<MessageInput onSend={mockOnSend} />);
      const input = screen.getByRole('textbox');
      // 100 chars — comfortably under the 9900 threshold.
      fireEvent.change(input, { target: { value: 'a'.repeat(100) } });
      // No "(N remaining)" suffix at this distance from the limit.
      expect(screen.queryByText(/\d+ remaining/)).toBeNull();
    });

    it('shows the (remaining) warning within 100 chars of the limit', () => {
      const mockOnSend = vi.fn();
      render(<MessageInput onSend={mockOnSend} />);
      const input = screen.getByRole('textbox');
      // 9950 chars: 50 remaining — past the warning threshold.
      fireEvent.change(input, { target: { value: 'a'.repeat(9950) } });
      // The warning text format from MessageInput.tsx:194: "(N remaining)".
      expect(screen.getByText(/\(50 remaining\)/)).toBeInTheDocument();
    });

    it('applies the warning text class once within the threshold', () => {
      const mockOnSend = vi.fn();
      const { container } = render(<MessageInput onSend={mockOnSend} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'a'.repeat(9950) } });
      // The component swaps the class to text-warning when remaining < 100.
      const charCountEl = container.querySelector('#char-count');
      expect(charCountEl?.className).toContain('text-warning');
    });

    it('keeps a polite live region on the char-count element', () => {
      const mockOnSend = vi.fn();
      const { container } = render(<MessageInput onSend={mockOnSend} />);
      const charCountEl = container.querySelector('#char-count');
      // aria-live="polite" is the contract — screen readers should
      // announce the count without interrupting the user mid-typing.
      expect(charCountEl?.getAttribute('aria-live')).toBe('polite');
    });

    it('always renders a numeric count, never literal "undefined"', () => {
      // AC-004: even though `message.length` cannot return NaN today, the
      // component falls back to `charCount || 0` in the render. Pin that
      // contract so a future refactor that introduces an undefined path
      // doesn't silently leak "undefined / 10000 characters" to the UI.
      const mockOnSend = vi.fn();
      render(<MessageInput onSend={mockOnSend} />);
      // Empty state — render the count region.
      const text = screen.getByText(/\/ 10000 characters/).textContent || '';
      expect(text).toMatch(/^\s*\d+\s*\//);
      expect(text).not.toMatch(/undefined|NaN/);
    });
  });
});
