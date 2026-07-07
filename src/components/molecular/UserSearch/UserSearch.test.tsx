import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserSearch from './UserSearch';
import { connectionService } from '@/services/messaging/connection-service';

vi.mock('@/services/messaging/connection-service', () => ({
  connectionService: {
    searchUsers: vi.fn(),
    sendFriendRequest: vi.fn(),
  },
}));

describe('UserSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search form', () => {
    render(<UserSearch />);
    expect(screen.getByLabelText(/search for users/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('disables search button when query is less than 3 characters', () => {
    render(<UserSearch />);
    const input = screen.getByPlaceholderText(/enter name/i);
    const button = screen.getByRole('button', { name: /search/i });

    fireEvent.change(input, { target: { value: 'ab' } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(button).not.toBeDisabled();
  });

  it('displays error for query less than 3 characters on submit', async () => {
    render(<UserSearch />);
    const input = screen.getByPlaceholderText(/enter name/i);
    const form = screen
      .getByRole('button', { name: /search/i })
      .closest('form')!;

    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/search query must be at least 3 characters/i)
      ).toBeInTheDocument();
    });
  });

  it('calls searchUsers on form submit', async () => {
    const mockResults = {
      users: [],
      already_connected: [],
    };
    vi.mocked(connectionService.searchUsers).mockResolvedValue(mockResults);

    render(<UserSearch />);
    const input = screen.getByPlaceholderText(/enter name/i);
    const button = screen.getByRole('button', { name: /search/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(connectionService.searchUsers).toHaveBeenCalledWith({
        query: 'test@example.com',
        limit: 10,
      });
    });
  });

  it('displays search results', async () => {
    const mockResults = {
      users: [
        {
          id: '1',
          display_name: 'Test User',
          avatar_url: null,
        },
      ],
      already_connected: [],
    };
    vi.mocked(connectionService.searchUsers).mockResolvedValue(mockResults);

    render(<UserSearch />);
    const input = screen.getByPlaceholderText(/enter name/i);
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /send request/i })
    ).toBeInTheDocument();
  });

  it('disables send request button for already connected users', async () => {
    const mockResults = {
      users: [
        {
          id: '1',
          display_name: 'Test User',
          avatar_url: null,
        },
      ],
      already_connected: ['1'],
    };
    vi.mocked(connectionService.searchUsers).mockResolvedValue(mockResults);

    render(<UserSearch />);
    fireEvent.change(screen.getByPlaceholderText(/enter name/i), {
      target: { value: 'testuser' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /request sent/i });
      expect(button).toBeDisabled();
    });
  });

  it('calls onRequestSent callback when request is sent', async () => {
    const mockResults = {
      users: [
        {
          id: '1',
          display_name: 'Test User',
          avatar_url: null,
        },
      ],
      already_connected: [],
    };
    vi.mocked(connectionService.searchUsers).mockResolvedValue(mockResults);
    vi.mocked(connectionService.sendFriendRequest).mockResolvedValue({} as any);

    const onRequestSent = vi.fn();
    render(<UserSearch onRequestSent={onRequestSent} />);

    fireEvent.change(screen.getByPlaceholderText(/enter name/i), {
      target: { value: 'testuser' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    const sendButton = screen.getByRole('button', { name: /send request/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(onRequestSent).toHaveBeenCalledWith('1');
    });
  });

  it('shows success message after sending request', async () => {
    const mockResults = {
      users: [
        {
          id: '1',
          display_name: 'Test User',
          avatar_url: null,
        },
      ],
      already_connected: [],
    };
    vi.mocked(connectionService.searchUsers).mockResolvedValue(mockResults);
    vi.mocked(connectionService.sendFriendRequest).mockResolvedValue({} as any);

    render(<UserSearch />);
    fireEvent.change(screen.getByPlaceholderText(/enter name/i), {
      target: { value: 'testuser' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/friend request sent successfully/i)
      ).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const { container } = render(<UserSearch className="custom-class" />);
    expect(
      container.querySelector('.user-search.custom-class')
    ).toBeInTheDocument();
  });
});
