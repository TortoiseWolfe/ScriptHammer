import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessagesSidebar from './MessagesSidebar';

// next/navigation — let the tabParam be controlled per-test via mockGet
const mockGet = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
    toString: () => '',
  }),
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

vi.mock('@/services/messaging/connection-service', () => ({
  connectionService: {
    getOrCreateConversation: vi.fn().mockResolvedValue('conv-new'),
  },
}));

// Capture props passed to UnifiedSidebar so we can assert wiring
const unifiedSidebarProps: Record<string, unknown>[] = [];
vi.mock('@/components/organisms/UnifiedSidebar', () => ({
  default: (props: Record<string, unknown>) => {
    unifiedSidebarProps.push(props);
    return (
      <div data-testid="unified-sidebar-mock">
        tab: {String(props.activeTab)}
      </div>
    );
  },
}));

describe('MessagesSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unifiedSidebarProps.length = 0;
    mockGet.mockReturnValue(null);
  });

  it('renders without crashing', () => {
    render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
      />
    );
    expect(screen.getByTestId('messages-sidebar')).toBeInTheDocument();
  });

  it('defaults to chats tab when no ?tab= param', () => {
    render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
      />
    );
    expect(screen.getByTestId('unified-sidebar-mock')).toHaveTextContent(
      'tab: chats'
    );
  });

  it('reads initial tab from URL ?tab= param', () => {
    mockGet.mockImplementation((key: string) =>
      key === 'tab' ? 'connections' : null
    );
    render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
      />
    );
    expect(screen.getByTestId('unified-sidebar-mock')).toHaveTextContent(
      'tab: connections'
    );
  });

  it('passes selectedConversationId through to UnifiedSidebar', () => {
    render(
      <MessagesSidebar
        selectedConversationId="conv-abc"
        onConversationSelect={vi.fn()}
      />
    );
    expect(unifiedSidebarProps[0].selectedConversationId).toBe('conv-abc');
  });

  it('passes onConversationSelect through to UnifiedSidebar', () => {
    const onSelect = vi.fn();
    render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={onSelect}
      />
    );
    expect(unifiedSidebarProps[0].onConversationSelect).toBe(onSelect);
  });

  it('wires connectionService.getOrCreateConversation for onStartConversation', async () => {
    const { connectionService } = await import(
      '@/services/messaging/connection-service'
    );
    render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
      />
    );
    const startConv = unifiedSidebarProps[0].onStartConversation as (
      id: string
    ) => Promise<string>;
    const result = await startConv('user-xyz');
    expect(connectionService.getOrCreateConversation).toHaveBeenCalledWith(
      'user-xyz'
    );
    expect(result).toBe('conv-new');
  });

  it('applies custom className', () => {
    render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
        className="custom-cls"
      />
    );
    expect(screen.getByTestId('messages-sidebar').className).toContain(
      'custom-cls'
    );
  });

  it('calls router.replace when tab changes', () => {
    render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
      />
    );
    const onTabChange = unifiedSidebarProps[0].onTabChange as (
      tab: string
    ) => void;
    onTabChange('connections');
    expect(mockReplace).toHaveBeenCalledWith('/messages?tab=connections', {
      scroll: false,
    });
  });
});
