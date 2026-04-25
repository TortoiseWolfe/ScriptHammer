/**
 * Accessibility Tests for MessageInput
 *
 * Verifies:
 * - No axe violations across the component's distinct states
 *   (default, disabled, sending)
 * - Send button has an accessible name (not just an icon)
 * - Send button meets the 44px touch target requirement (mobile-first)
 * - Textarea is reachable by keyboard via the standard `textbox` role
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MessageInput from './MessageInput';

expect.extend(toHaveNoViolations);

describe('MessageInput Accessibility', () => {
  it('has no axe violations in the default state', async () => {
    const { container } = render(<MessageInput onSend={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when disabled', async () => {
    const { container } = render(<MessageInput onSend={vi.fn()} disabled />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations while sending', async () => {
    const { container } = render(<MessageInput onSend={vi.fn()} sending />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exposes an accessible name on the send button', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const send = screen.getByRole('button', { name: /send/i });
    expect(send).toBeInTheDocument();
  });

  it('uses a textarea so the input is reachable by keyboard', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
  });

  it('respects the 44px touch-target rule for the send button', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const send = screen.getByRole('button', { name: /send/i });
    // CLAUDE.md mandates min-h-11 / min-w-11 (44px) for interactive elements
    // on mobile. Tailwind class is the simplest assertion in unit tests.
    const className = send.getAttribute('class') || '';
    expect(className).toMatch(/min-h-11|h-11|h-12/);
  });
});
