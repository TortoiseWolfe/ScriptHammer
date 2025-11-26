import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConnectionManager from './ConnectionManager';
import { useConnections } from '@/hooks/useConnections';

vi.mock('@/hooks/useConnections');

const mockConnections = {
  pending_sent: [
    {
      connection: {
        id: '1',
        requester_id: 'user1',
        addressee_id: 'user2',
        status: 'pending' as const,
        created_at: '',
        updated_at: '',
      },
      requester: {
        id: 'user1',
        username: 'requester',
        display_name: 'Requester',
        avatar_url: null,
      },
      addressee: {
        id: 'user2',
        username: 'addressee',
        display_name: 'Addressee',
        avatar_url: null,
      },
    },
  ],
  pending_received: [],
  accepted: [],
  blocked: [],
};

describe('ConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tabs', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    expect(
      screen.getByRole('tab', { name: /pending received/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /pending sent/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /accepted/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /blocked/i })).toBeInTheDocument();
  });

  it('displays loading state', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: true,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('displays error message', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: 'Test error',
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    const sentTab = screen.getByRole('tab', { name: /pending sent/i });
    fireEvent.click(sentTab);
    expect(sentTab.classList.contains('tab-active')).toBe(true);
  });

  it('displays sent connections', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    fireEvent.click(screen.getByRole('tab', { name: /pending sent/i }));
    expect(screen.getByText('Addressee')).toBeInTheDocument();
  });

  it('calls acceptRequest when accept button clicked', async () => {
    const acceptRequest = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConnections).mockReturnValue({
      connections: {
        ...mockConnections,
        pending_received: mockConnections.pending_sent,
      },
      loading: false,
      error: null,
      acceptRequest,
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(acceptRequest).toHaveBeenCalledWith('1');
    });
  });

  it('shows block confirmation modal', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: {
        ...mockConnections,
        pending_received: mockConnections.pending_sent,
      },
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    fireEvent.click(screen.getByRole('button', { name: /block/i }));
    expect(
      screen.getByText(/are you sure you want to block/i)
    ).toBeInTheDocument();
  });

  describe('Message button (Feature 037)', () => {
    const acceptedConnection = {
      connection: {
        id: 'conn-1',
        requester_id: 'current-user',
        addressee_id: 'other-user',
        status: 'accepted' as const,
        created_at: '',
        updated_at: '',
      },
      requester: {
        id: 'current-user',
        username: 'me',
        display_name: 'Me',
        avatar_url: null,
      },
      addressee: {
        id: 'other-user',
        username: 'friend',
        display_name: 'My Friend',
        avatar_url: null,
      },
    };

    it('renders Message button for accepted connections when onMessage prop provided', () => {
      vi.mocked(useConnections).mockReturnValue({
        connections: {
          ...mockConnections,
          accepted: [acceptedConnection],
        },
        loading: false,
        error: null,
        acceptRequest: vi.fn(),
        declineRequest: vi.fn(),
        blockUser: vi.fn(),
        removeConnection: vi.fn(),
        refreshConnections: vi.fn(),
      });

      const onMessage = vi.fn();
      render(<ConnectionManager onMessage={onMessage} />);

      // Switch to accepted tab
      fireEvent.click(screen.getByRole('tab', { name: /accepted/i }));

      expect(screen.getByTestId('message-button')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /message/i })
      ).toBeInTheDocument();
    });

    it('does not render Message button when onMessage prop is undefined', () => {
      vi.mocked(useConnections).mockReturnValue({
        connections: {
          ...mockConnections,
          accepted: [acceptedConnection],
        },
        loading: false,
        error: null,
        acceptRequest: vi.fn(),
        declineRequest: vi.fn(),
        blockUser: vi.fn(),
        removeConnection: vi.fn(),
        refreshConnections: vi.fn(),
      });

      render(<ConnectionManager />);

      // Switch to accepted tab
      fireEvent.click(screen.getByRole('tab', { name: /accepted/i }));

      expect(screen.queryByTestId('message-button')).not.toBeInTheDocument();
    });

    it('calls onMessage with correct userId when Message button clicked', async () => {
      vi.mocked(useConnections).mockReturnValue({
        connections: {
          ...mockConnections,
          accepted: [acceptedConnection],
        },
        loading: false,
        error: null,
        acceptRequest: vi.fn(),
        declineRequest: vi.fn(),
        blockUser: vi.fn(),
        removeConnection: vi.fn(),
        refreshConnections: vi.fn(),
      });

      const onMessage = vi.fn();
      render(<ConnectionManager onMessage={onMessage} />);

      // Switch to accepted tab
      fireEvent.click(screen.getByRole('tab', { name: /accepted/i }));

      // Click Message button
      fireEvent.click(screen.getByTestId('message-button'));

      // Should call onMessage with the other user's ID (addressee since requester is current user)
      expect(onMessage).toHaveBeenCalledWith('other-user');
    });
  });
});
