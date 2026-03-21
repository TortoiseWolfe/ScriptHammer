import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import EmptyConversationPrompt from './EmptyConversationPrompt';

expect.extend(toHaveNoViolations);

describe('EmptyConversationPrompt Accessibility', () => {
  it('should have no accessibility violations (no button)', async () => {
    const { container } = render(<EmptyConversationPrompt />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (with button)', async () => {
    const { container } = render(
      <EmptyConversationPrompt onOpenSidebar={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('decorative SVG is hidden from AT', () => {
    const { container } = render(<EmptyConversationPrompt />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('heading is an h2', () => {
    render(<EmptyConversationPrompt />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Select a conversation' })
    ).toBeInTheDocument();
  });

  it('button meets 44px touch target (min-h-11)', () => {
    render(<EmptyConversationPrompt onOpenSidebar={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /open sidebar/i });
    expect(btn.className).toContain('min-h-11');
  });
});
