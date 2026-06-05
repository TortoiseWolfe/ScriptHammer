import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable supabase mock: .from().select().order().limit() resolves to { data, error }.
const limitMock = vi.fn();
const orderMock = vi.fn(() => ({ limit: limitMock }));
const selectMock = vi.fn(() => ({ order: orderMock }));
const fromMock = vi.fn((_table: string) => ({ select: selectMock }));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
  },
}));

import UserAuditTrail from './UserAuditTrail';

const ROW = {
  id: '00000000-0000-0000-0000-000000000001',
  event_type: 'sign_in_success',
  success: true,
  ip_address: '203.0.113.7',
  user_agent: 'Mozilla/5.0',
  created_at: '2026-06-01T10:00:00.000Z',
};

describe('UserAuditTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue({ data: [ROW], error: null });
  });

  it('renders without crashing', () => {
    const { container } = render(<UserAuditTrail />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('queries the user audit log via RLS-scoped select (no client-side user_id filter)', async () => {
    render(<UserAuditTrail limit={10} />);
    await waitFor(() =>
      expect(fromMock).toHaveBeenCalledWith('auth_audit_logs')
    );
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('renders a humanized event label + success badge for each entry', async () => {
    render(<UserAuditTrail />);
    expect(await screen.findByText('Signed in')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
  });

  it('shows a failed badge for unsuccessful events', async () => {
    limitMock.mockResolvedValue({
      data: [{ ...ROW, event_type: 'sign_in_failed', success: false }],
      error: null,
    });
    render(<UserAuditTrail />);
    expect(await screen.findByText('Failed sign-in')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });
    render(<UserAuditTrail />);
    expect(
      await screen.findByText('No recent activity to show.')
    ).toBeInTheDocument();
  });

  it('shows an error alert when the query fails', async () => {
    limitMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    render(<UserAuditTrail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });

  it('defaults to a limit of 25 when none is given', async () => {
    render(<UserAuditTrail />);
    await waitFor(() => expect(limitMock).toHaveBeenCalledWith(25));
  });
});
