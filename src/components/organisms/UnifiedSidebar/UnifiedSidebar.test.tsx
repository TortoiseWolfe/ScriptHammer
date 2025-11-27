import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UnifiedSidebar from './UnifiedSidebar';

// Mock child components
vi.mock('@/components/organisms/ConversationList', () => ({
  default: ({
    selectedConversationId,
  }: {
    selectedConversationId?: string | null;
  }) => (
    <div data-testid="conversation-list" data-selected={selectedConversationId}>
      ConversationList
    </div>
  ),
}));

vi.mock('@/components/organisms/ConnectionManager', () => ({
  default: ({ onMessage }: { onMessage?: (userId: string) => void }) => (
    <div data-testid="connection-manager">
      ConnectionManager
      {onMessage && (
        <button
          data-testid="mock-message-btn"
          onClick={() => onMessage('user-123')}
        >
          Mock Message
        </button>
      )}
    </div>
  ),
}));

const defaultProps = {
  onConversationSelect: vi.fn(),
  onStartConversation: vi.fn().mockResolvedValue('conv-123'),
  activeTab: 'chats' as const,
  onTabChange: vi.fn(),
};

describe('UnifiedSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<UnifiedSidebar {...defaultProps} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    render(<UnifiedSidebar {...defaultProps} className={customClass} />);
    expect(screen.getByTestId('unified-sidebar')).toHaveClass(customClass);
  });

  it('renders both tabs (Chats, Connections)', () => {
    render(<UnifiedSidebar {...defaultProps} />);

    expect(screen.getByRole('tab', { name: /chats/i })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /connections/i })
    ).toBeInTheDocument();
  });

  it('highlights active tab correctly', () => {
    render(<UnifiedSidebar {...defaultProps} activeTab="connections" />);

    const connectionsTab = screen.getByRole('tab', { name: /connections/i });
    expect(connectionsTab).toHaveClass('tab-active');
    expect(connectionsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onTabChange when tab clicked', () => {
    const onTabChange = vi.fn();
    render(<UnifiedSidebar {...defaultProps} onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('tab', { name: /connections/i }));
    expect(onTabChange).toHaveBeenCalledWith('connections');

    fireEvent.click(screen.getByRole('tab', { name: /chats/i }));
    expect(onTabChange).toHaveBeenCalledWith('chats');
  });

  it('renders ConversationList when chats tab active', () => {
    render(<UnifiedSidebar {...defaultProps} activeTab="chats" />);
    expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    expect(screen.queryByTestId('connection-manager')).not.toBeInTheDocument();
  });

  it('renders ConnectionManager when connections tab active', () => {
    render(<UnifiedSidebar {...defaultProps} activeTab="connections" />);
    expect(screen.getByTestId('connection-manager')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-list')).not.toBeInTheDocument();
  });

  it('displays unread count badge on Chats tab when count > 0', () => {
    render(<UnifiedSidebar {...defaultProps} unreadCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('5')).toHaveClass('badge');
  });

  it('does not display badge when unread count is 0', () => {
    render(<UnifiedSidebar {...defaultProps} unreadCount={0} />);
    const chatsTab = screen.getByRole('tab', { name: /chats/i });
    expect(chatsTab.querySelector('.badge')).not.toBeInTheDocument();
  });

  it('displays pending connection count badge on Connections tab when count > 0', () => {
    render(<UnifiedSidebar {...defaultProps} pendingConnectionCount={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('3')).toHaveClass('badge');
  });

  it('passes selectedConversationId to ConversationList', () => {
    render(
      <UnifiedSidebar
        {...defaultProps}
        activeTab="chats"
        selectedConversationId="conv-456"
      />
    );
    expect(screen.getByTestId('conversation-list')).toHaveAttribute(
      'data-selected',
      'conv-456'
    );
  });

  it('handles message from ConnectionManager', async () => {
    const onStartConversation = vi.fn().mockResolvedValue('new-conv-123');
    const onConversationSelect = vi.fn();
    const onTabChange = vi.fn();

    render(
      <UnifiedSidebar
        {...defaultProps}
        activeTab="connections"
        onStartConversation={onStartConversation}
        onConversationSelect={onConversationSelect}
        onTabChange={onTabChange}
      />
    );

    // Click the mock message button from ConnectionManager
    fireEvent.click(screen.getByTestId('mock-message-btn'));

    await waitFor(() => {
      expect(onStartConversation).toHaveBeenCalledWith('user-123');
      expect(onConversationSelect).toHaveBeenCalledWith('new-conv-123');
      expect(onTabChange).toHaveBeenCalledWith('chats');
    });
  });

  it('has proper tablist role on tab container', () => {
    render(<UnifiedSidebar {...defaultProps} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('has proper tabpanel role on content area', () => {
    render(<UnifiedSidebar {...defaultProps} />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });
});
