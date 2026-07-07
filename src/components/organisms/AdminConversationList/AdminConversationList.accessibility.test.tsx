import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AdminConversationList } from './AdminConversationList';
import type { AdminConversationRow } from '@/services/admin/admin-messaging-service';

expect.extend(toHaveNoViolations);

const ROWS: AdminConversationRow[] = [
  {
    conversation_id: 'abc12345-0000-0000-0000-000000000001',
    is_group: false,
    participant_count: 2,
    message_count: 847,
    last_activity: '2026-03-18T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    conversation_id: 'def67890-0000-0000-0000-000000000002',
    is_group: true,
    participant_count: 5,
    message_count: 12,
    last_activity: '2026-03-21T10:00:00Z',
    created_at: '2026-02-15T00:00:00Z',
  },
];

describe('AdminConversationList Accessibility', () => {
  const baseProps = {
    data: ROWS,
    total: 120,
    offset: 0,
    pageSize: 50,
    onPageChange: vi.fn(),
  };

  it('has no axe violations with data', async () => {
    const { container } = render(<AdminConversationList {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in loading state', async () => {
    const { container } = render(
      <AdminConversationList {...baseProps} isLoading />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in empty state', async () => {
    const { container } = render(
      <AdminConversationList {...baseProps} data={[]} total={0} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('section is labelled by its heading', () => {
    const { container } = render(<AdminConversationList {...baseProps} />);
    const section = container.querySelector('section');
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Conversations',
    });
    expect(section).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('pagination <nav> has an accessible name', () => {
    render(<AdminConversationList {...baseProps} />);
    expect(
      screen.getByRole('navigation', {
        name: /conversation list pagination/i,
      })
    ).toBeInTheDocument();
  });

  it('row-count line is a live region for page changes', () => {
    render(<AdminConversationList {...baseProps} />);
    const count = screen.getByText(/Showing 1–2 of 120/);
    expect(count).toHaveAttribute('aria-live', 'polite');
  });

  it('pagination buttons meet 44px touch target (min-h-11)', () => {
    render(<AdminConversationList {...baseProps} />);
    const prev = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(prev.className).toContain('min-h-11');
    expect(next.className).toContain('min-h-11');
  });
});
