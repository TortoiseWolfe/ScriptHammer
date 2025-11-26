import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationList from './ConversationList';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock useConversationList hook
vi.mock('./useConversationList', () => ({
  useConversationList: () => ({
    conversations: [],
    counts: { all: 0, unread: 0, archived: 0, totalUnread: 0 },
    loading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    filterType: 'all',
    setFilterType: vi.fn(),
    sortType: 'recent',
    setSortType: vi.fn(),
    reload: vi.fn(),
    archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(),
  }),
}));

// Mock useKeyboardShortcuts hook
vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => {},
  shortcuts: {
    openSearch: (callback: any) => ({
      key: 'k',
      ctrlOrCmd: true,
      callback,
      description: 'Open search',
    }),
    closeModal: (callback: any) => ({
      key: 'Escape',
      callback,
      description: 'Close modal',
    }),
    submitForm: (callback: any) => ({
      key: 'Enter',
      ctrlOrCmd: true,
      callback,
      description: 'Submit form',
    }),
    previousItem: (callback: any) => ({
      key: 'ArrowUp',
      callback,
      description: 'Previous item',
    }),
    nextItem: (callback: any) => ({
      key: 'ArrowDown',
      callback,
      description: 'Next item',
    }),
    jumpToItem: (number: number, callback: any) => ({
      key: number.toString(),
      ctrlOrCmd: true,
      callback,
      description: `Jump to item ${number}`,
    }),
  },
}));

describe('ConversationList', () => {
  it('renders without crashing', () => {
    const { container } = render(<ConversationList />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    const { container } = render(<ConversationList className={customClass} />);
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });

  it('renders with selected conversation ID', () => {
    const { container } = render(
      <ConversationList selectedConversationId="conversation-123" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  // Add component-specific tests based on actual functionality
});
