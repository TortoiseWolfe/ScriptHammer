import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AdminConversationList,
  STALE_THRESHOLD_MS,
} from './AdminConversationList';
import type { AdminConversationRow } from '@/services/admin/admin-messaging-service';

// Pin "now" so the relativeTime() formatter is deterministic. Without this,
// the "3 days ago" / "2 hours ago" assertions would drift as wall-clock
// advances between the fixture timestamps and the test run. Fake timers are
// opted into per-test rather than in beforeEach — the pagination click tests
// use real timers because userEvent's internal delay-queue stalls under a
// frozen clock, and those tests don't touch relativeTime() anyway.
const FIXED_NOW = new Date('2026-03-21T12:00:00Z');

function withFrozenNow(fn: () => void) {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  try {
    fn();
  } finally {
    vi.useRealTimers();
  }
}

const ROWS: AdminConversationRow[] = [
  {
    conversation_id: 'abc12345-0000-0000-0000-000000000001',
    is_group: false,
    participant_count: 2,
    message_count: 847,
    last_activity: '2026-03-18T10:00:00Z', // 3 days before FIXED_NOW
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    conversation_id: 'def67890-0000-0000-0000-000000000002',
    is_group: true,
    participant_count: 5,
    message_count: 12,
    last_activity: '2026-03-21T10:00:00Z', // 2 hours before FIXED_NOW
    created_at: '2026-02-15T00:00:00Z',
  },
];

describe('AdminConversationList', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = {
    data: ROWS,
    total: 120,
    offset: 0,
    pageSize: 50,
    onPageChange: vi.fn(),
  };

  it('renders heading and row count line', () => {
    render(<AdminConversationList {...baseProps} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Conversations' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Showing 1–2 of 120/)).toBeInTheDocument();
  });

  it('truncates conversation_id to 8 chars with full value in title', () => {
    render(<AdminConversationList {...baseProps} />);
    const short = screen.getByText('abc12345…');
    expect(short).toHaveAttribute(
      'title',
      'abc12345-0000-0000-0000-000000000001'
    );
  });

  it('shows group badge only when is_group is true', () => {
    render(<AdminConversationList {...baseProps} />);
    const badges = screen.getAllByText('group');
    expect(badges).toHaveLength(1);
    // The badge should sit in the same row as the def6… ID
    const groupRow = badges[0].closest('tr');
    expect(groupRow).toHaveTextContent('def67890…');
  });

  it('formats message_count with locale thousands separator', () => {
    render(
      <AdminConversationList
        {...baseProps}
        data={[{ ...ROWS[0], message_count: 12345 }]}
        total={1}
      />
    );
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('formats last_activity as relative time', () => {
    withFrozenNow(() => {
      render(<AdminConversationList {...baseProps} />);
      // Intl.RelativeTimeFormat with numeric:'auto' — "3 days ago", "2 hours ago"
      expect(screen.getByText(/3 days ago/i)).toBeInTheDocument();
      expect(screen.getByText(/2 hours ago/i)).toBeInTheDocument();
    });
  });

  it('flags conversations past STALE_THRESHOLD_MS with a badge', () => {
    withFrozenNow(() => {
      // One hour past the threshold. The threshold is strictly-greater, so
      // this is the first moment the badge appears.
      const stale = new Date(
        FIXED_NOW.getTime() - STALE_THRESHOLD_MS - 60 * 60 * 1000
      ).toISOString();
      render(
        <AdminConversationList
          {...baseProps}
          data={[
            { ...ROWS[0], last_activity: stale },
            ROWS[1], // 2 hours ago — fresh
          ]}
        />
      );
      const badges = screen.getAllByText('stale');
      expect(badges).toHaveLength(1);
      // Badge lives in the same row as the stale timestamp, not the fresh one.
      expect(badges[0].closest('tr')).toHaveTextContent('abc12345…');
      // The wrapping span carries data-stale for the E2E selector.
      expect(badges[0].closest('[data-stale]')).toHaveAttribute(
        'data-stale',
        'true'
      );
    });
  });

  it('does not flag at exactly STALE_THRESHOLD_MS (strictly greater)', () => {
    withFrozenNow(() => {
      const atThreshold = new Date(
        FIXED_NOW.getTime() - STALE_THRESHOLD_MS
      ).toISOString();
      render(
        <AdminConversationList
          {...baseProps}
          data={[{ ...ROWS[0], last_activity: atThreshold }]}
          total={1}
        />
      );
      expect(screen.queryByText('stale')).not.toBeInTheDocument();
    });
  });

  it('marks fresh rows with data-stale=false and no badge', () => {
    withFrozenNow(() => {
      render(<AdminConversationList {...baseProps} />);
      // Both fixture rows are under 30d.
      const cells = screen.getAllByTitle(/2026/);
      cells
        .filter((c) => c.hasAttribute('data-stale'))
        .forEach((c) => expect(c).toHaveAttribute('data-stale', 'false'));
      expect(screen.queryByText('stale')).not.toBeInTheDocument();
    });
  });

  it('disables Previous at offset 0', () => {
    render(<AdminConversationList {...baseProps} offset={0} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('disables Next when the current page reaches total', () => {
    render(
      <AdminConversationList
        {...baseProps}
        offset={100}
        pageSize={50}
        total={120}
      />
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onPageChange with offset + pageSize on Next click', () => {
    const onPageChange = vi.fn();
    render(
      <AdminConversationList
        {...baseProps}
        offset={50}
        pageSize={50}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(100);
  });

  it('calls onPageChange with offset - pageSize on Previous, clamped to 0', () => {
    const onPageChange = vi.fn();
    render(
      <AdminConversationList
        {...baseProps}
        offset={30}
        pageSize={50}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it('shows 0–0 of 0 when total is zero (not 1–0)', () => {
    render(
      <AdminConversationList
        {...baseProps}
        data={[]}
        total={0}
        offset={0}
      />
    );
    expect(screen.getByText(/Showing 0–0 of 0/)).toBeInTheDocument();
  });

  it('delegates isLoading to AdminDataTable spinner', () => {
    render(<AdminConversationList {...baseProps} isLoading />);
    expect(
      screen.getByRole('status', { name: /loading data/i })
    ).toBeInTheDocument();
  });

  it('disables both pagination buttons while loading', () => {
    render(
      <AdminConversationList {...baseProps} offset={50} isLoading />
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
