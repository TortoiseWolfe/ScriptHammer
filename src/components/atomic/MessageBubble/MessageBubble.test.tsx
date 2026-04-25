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

    /**
     * Edge cases (#36) — the parseMarkdown regex is intentionally non-nesting
     * (`[^*]+` between delimiters means inner asterisks aren't allowed). The
     * tests below pin down that contract so a future refactor doesn't quietly
     * change behavior. Spec: features/polish/027-ux-polish/spec.md FR-005..012.
     */
    it('preserves empty bold delimiters (****) as plain text', () => {
      const { container } = render(
        <MessageBubble message={createMessage('text **** end')} />
      );
      // No empty <strong> tag should be rendered; **** must round-trip as text.
      expect(container.querySelector('strong')).toBeNull();
      expect(container.textContent).toContain('****');
    });

    it('preserves bare asterisks (** alone) as plain text', () => {
      const { container } = render(
        <MessageBubble message={createMessage('start ** end')} />
      );
      expect(container.querySelector('strong')).toBeNull();
      expect(container.textContent).toContain('**');
    });

    it('preserves backticks-without-content as plain text', () => {
      const { container } = render(
        <MessageBubble message={createMessage('text `` end')} />
      );
      expect(container.querySelector('code')).toBeNull();
      expect(container.textContent).toContain('``');
    });

    it('does not nest **bold *italic***  (regex is intentionally non-nesting)', () => {
      // The `[^*]+` constraint means inner asterisks break the outer bold
      // match. The current implementation treats this as plain text — the
      // test pins that contract so future refactors must opt-in to nesting.
      const { container } = render(
        <MessageBubble message={createMessage('**bold *italic***')} />
      );
      // We expect *no* nested <strong><em>; the asterisks survive as text.
      // Either no <strong>/<em> at all, or any nested combo would be a regression.
      const strong = container.querySelector('strong em');
      const em = container.querySelector('em strong');
      expect(strong).toBeNull();
      expect(em).toBeNull();
    });

    it('renders multiple bold sections in the same string', () => {
      render(
        <MessageBubble
          message={createMessage('**first** middle **second** end')}
        />
      );
      expect(screen.getByText('first').tagName).toBe('STRONG');
      expect(screen.getByText('second').tagName).toBe('STRONG');
    });

    it('renders empty content harmlessly', () => {
      const { container } = render(
        <MessageBubble message={createMessage('')} />
      );
      // No crash; the bubble exists but content is empty
      expect(
        container.querySelector('[data-testid="message-bubble"]')
      ).not.toBeNull();
    });

    it('does not render HTML tags in content as real elements (no XSS)', () => {
      // NFR-006: input must not be parsed as HTML. parseMarkdown's regex only
      // matches its own delimiters; React's default escaping covers the rest.
      const { container } = render(
        <MessageBubble
          message={createMessage('<script>alert(1)</script> hello')}
        />
      );
      // No real <script> element should land in the DOM.
      expect(container.querySelector('script')).toBeNull();
      // The literal text including angle brackets should be present.
      expect(container.textContent).toContain('<script>alert(1)</script>');
    });

    it('keeps unclosed *italic preserved verbatim', () => {
      render(<MessageBubble message={createMessage('start *unclosed end')} />);
      // The literal asterisk + word is preserved as plain text.
      expect(screen.getByText(/\*unclosed end/)).toBeInTheDocument();
    });
  });
});
