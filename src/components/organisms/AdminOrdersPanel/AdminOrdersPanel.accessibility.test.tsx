import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import AdminOrdersPanel from './AdminOrdersPanel';

const result = { data: [] as unknown[], error: null };
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ limit: () => Promise.resolve(result) }),
      }),
    }),
  },
}));

beforeEach(() => {
  result.data = [
    {
      id: 'o1',
      product_id: 'svc-site',
      buyer_email: 'b@example.com',
      amount_charged: 175000,
      status: 'paid',
      created_at: '2026-08-07T12:00:00Z',
      intake_data: {
        business: 'Warrior Roofing',
        attachments: [
          {
            path: 'uid/a.png',
            name: 'a.png',
            bytes: 1,
            mime: 'image/png',
            kind: 'current',
          },
        ],
      },
    },
  ];
});

describe('AdminOrdersPanel accessibility', () => {
  it('has no axe violations with orders present', async () => {
    const { container } = render(<AdminOrdersPanel />);
    await screen.findByTestId('admin-order');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces loading as a status region', () => {
    render(<AdminOrdersPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(/Loading/);
  });
});
