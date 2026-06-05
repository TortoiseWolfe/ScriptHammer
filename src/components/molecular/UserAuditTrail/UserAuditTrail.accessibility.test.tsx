import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

const limitMock = vi.fn();
const orderMock = vi.fn(() => ({ limit: limitMock }));
const selectMock = vi.fn(() => ({ order: orderMock }));
const fromMock = vi.fn((_table: string) => ({ select: selectMock }));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: (table: string) => fromMock(table) },
}));

import UserAuditTrail from './UserAuditTrail';

expect.extend(toHaveNoViolations);

const ROW = {
  id: '00000000-0000-0000-0000-000000000001',
  event_type: 'sign_in_success',
  success: true,
  ip_address: '203.0.113.7',
  user_agent: 'Mozilla/5.0',
  created_at: '2026-06-01T10:00:00.000Z',
};

describe('UserAuditTrail Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue({ data: [ROW], error: null });
  });

  it('should have no accessibility violations (populated table)', async () => {
    const { container, findByText } = render(<UserAuditTrail />);
    await findByText('Signed in'); // wait for data render
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (empty state)', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });
    const { container, findByText } = render(<UserAuditTrail />);
    await findByText('No recent activity to show.');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should label the region and table for screen readers', async () => {
    const { container, findByText } = render(<UserAuditTrail />);
    await findByText('Signed in');
    // section is labelled by its heading
    const section = container.querySelector('section[aria-labelledby]');
    expect(section).toBeInTheDocument();
    // table has a caption
    await waitFor(() =>
      expect(container.querySelector('table caption')).toBeInTheDocument()
    );
  });
});
