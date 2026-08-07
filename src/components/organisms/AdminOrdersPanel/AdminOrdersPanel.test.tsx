import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminOrdersPanel from './AdminOrdersPanel';

const result = {
  data: [] as unknown[],
  error: null as { message: string } | null,
};

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ limit: () => Promise.resolve(result) }),
      }),
    }),
  },
}));

const signed = vi.fn();
vi.mock('@/lib/commerce/intake-upload', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/commerce/intake-upload')
  >('@/lib/commerce/intake-upload');
  return { ...actual, getIntakeSignedUrl: (p: string) => signed(p) };
});

const order = (over = {}) => ({
  id: 'o1',
  product_id: 'svc-site',
  buyer_email: 'buyer@example.com',
  amount_charged: 175000,
  status: 'paid',
  created_at: '2026-08-07T12:00:00Z',
  intake_data: {
    business: 'Warrior Roofing',
    phone: '(423) 555-0137',
    attachments: [
      {
        path: 'uid/a.png',
        name: 'current-site.png',
        bytes: 2048,
        mime: 'image/png',
        kind: 'current',
      },
      {
        path: 'uid/b.heic',
        name: 'the-look.heic',
        bytes: 4096,
        mime: 'image/heic',
        kind: 'target',
      },
    ],
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  result.data = [];
  result.error = null;
  signed.mockResolvedValue({ url: 'https://signed.example/x' });
  window.open = vi.fn();
});

describe('AdminOrdersPanel', () => {
  it('renders an order with the buyer details the operator needs', async () => {
    result.data = [order()];
    render(<AdminOrdersPanel />);
    expect(await screen.findByTestId('admin-order')).toBeInTheDocument();
    expect(screen.getByText(/Warrior Roofing/)).toBeInTheDocument();
    expect(screen.getByText(/\(423\) 555-0137/)).toBeInTheDocument();
    expect(screen.getByText('$1,750.00')).toBeInTheDocument();
  });

  it('shows each attachment with its have/want tag in plain words', async () => {
    result.data = [order()];
    render(<AdminOrdersPanel />);
    expect(await screen.findByText('current-site.png')).toBeInTheDocument();
    expect(screen.getByText(/what they have/)).toBeInTheDocument();
    expect(screen.getByText(/what they want/)).toBeInTheDocument();
  });

  it('marks formats it cannot preview', async () => {
    result.data = [order()];
    render(<AdminOrdersPanel />);
    expect(await screen.findByText(/no preview/)).toBeInTheDocument();
  });

  // The bucket is private. Minting a URL per file at load would create dozens of
  // live one-hour credentials for files nobody opened.
  it('signs nothing until the operator asks to open a file', async () => {
    result.data = [order()];
    render(<AdminOrdersPanel />);
    await screen.findByText('current-site.png');
    expect(signed).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /Open/ })[0]);
    await waitFor(() => expect(signed).toHaveBeenCalledWith('uid/a.png'));
    expect(window.open).toHaveBeenCalledWith(
      'https://signed.example/x',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('surfaces a signing failure instead of opening a blank tab', async () => {
    result.data = [order()];
    signed.mockResolvedValue({ error: 'Object not found' });
    render(<AdminOrdersPanel />);
    await screen.findByText('current-site.png');
    fireEvent.click(screen.getAllByRole('button', { name: /Open/ })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Object not found'
    );
    expect(window.open).not.toHaveBeenCalled();
  });

  // A failed query and an empty result look identical if you only check length.
  it('reports a query error rather than claiming there are no orders', async () => {
    result.error = { message: 'permission denied for table orders' };
    render(<AdminOrdersPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /permission denied/
    );
    expect(screen.queryByText('No orders yet.')).toBeNull();
  });

  it('says so when there genuinely are none', async () => {
    render(<AdminOrdersPanel />);
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();
  });

  it('handles an order with no attachments', async () => {
    result.data = [order({ intake_data: { business: 'Solo' } })];
    render(<AdminOrdersPanel />);
    expect(await screen.findByTestId('admin-order')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open/ })).toBeNull();
  });
});
