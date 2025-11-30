'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ConversationListItem from '@/components/molecular/ConversationListItem';
import {
  useConversationList,
  type FilterType,
  type SortType,
} from './useConversationList';
import { useKeyboardShortcuts, shortcuts } from '@/hooks/useKeyboardShortcuts';

export interface ConversationListProps {
  /** Currently selected conversation ID */
  selectedConversationId?: string | null;
  /** Callback when unread count changes */
  onUnreadCountChange?: (count: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ConversationList component
 *
 * Displays list of all conversations with:
 * - Search by participant name (debounced 300ms)
 * - Filter: All, Unread, Archived
 * - Sort: Recent, Alphabetical, Unread First
 * - Click to navigate to /messages?conversation={id}
 * - Loading state, empty state
 * - Real-time updates
 *
 * @category organisms
 */
export default function ConversationList({
  selectedConversationId,
  onUnreadCountChange,
  className = '',
}: ConversationListProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    conversations,
    counts,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    sortType,
    setSortType,
    reload,
    archiveConversation,
    unarchiveConversation,
  } = useConversationList();

  const [searchInput, setSearchInput] = useState('');
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(
    null
  );

  // Notify parent of unread count changes
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(counts.unread);
    }
  }, [counts.unread, onUnreadCountChange]);

  // Keyboard shortcuts integration (T215)
  useKeyboardShortcuts([
    // Ctrl+K: Focus search input
    shortcuts.openSearch((e) => {
      e.preventDefault();
      searchInputRef.current?.focus();
    }),
    // Escape: Clear search
    shortcuts.closeModal(() => {
      if (searchQuery || searchInput) {
        handleClearSearch();
      }
    }),
    // Ctrl+1-9: Jump to conversation
    ...Array.from({ length: 9 }, (_, i) =>
      shortcuts.jumpToItem(i + 1, (e) => {
        e.preventDefault();
        if (conversations[i]) {
          handleConversationClick(conversations[i].id);
        }
      })
    ),
  ]);

  // Debounced search (300ms)
  const handleSearchChange = (value: string) => {
    setSearchInput(value);

    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    const timeout = setTimeout(() => {
      setSearchQuery(value);
    }, 300);

    setSearchDebounce(timeout);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/messages?conversation=${conversationId}`);
  };

  return (
    <div className={`bg-base-100 flex h-full flex-col ${className}`}>
      {/* Header */}
      <div className="border-base-300 border-b p-4">
        <h1 className="mb-4 text-2xl font-bold">Messages</h1>

        {/* Search */}
        <div className="form-control">
          <div className="input-group">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search conversations..."
              className="input input-bordered min-h-11 w-full"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Search conversations"
            />
            {searchInput && (
              <button
                className="btn btn-square min-h-11 min-w-11"
                onClick={handleClearSearch}
                aria-label="Clear conversation search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="tabs tabs-boxed mt-3" role="tablist">
          <button
            className={`tab min-h-11 ${filterType === 'all' ? 'tab-active' : ''}`}
            onClick={() => setFilterType('all')}
            role="tab"
            aria-selected={filterType === 'all'}
          >
            All
            {counts.all > 0 && (
              <span className="badge badge-sm ml-1">{counts.all}</span>
            )}
          </button>
          <button
            className={`tab min-h-11 ${filterType === 'unread' ? 'tab-active' : ''}`}
            onClick={() => setFilterType('unread')}
            role="tab"
            aria-selected={filterType === 'unread'}
          >
            Unread
            {counts.unread > 0 && (
              <span className="badge badge-primary badge-sm ml-1">
                {counts.unread}
              </span>
            )}
          </button>
          <button
            className={`tab min-h-11 ${filterType === 'archived' ? 'tab-active' : ''}`}
            onClick={() => setFilterType('archived')}
            role="tab"
            aria-selected={filterType === 'archived'}
          >
            Archived
            {counts.archived > 0 && (
              <span className="badge badge-sm ml-1">{counts.archived}</span>
            )}
          </button>
        </div>

        {/* Sort dropdown */}
        <div className="form-control mt-3">
          <label className="label">
            <span className="label-text">Sort by</span>
          </label>
          <select
            className="select select-bordered min-h-11 w-full"
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            aria-label="Sort conversations"
          >
            <option value="recent">Most Recent</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="unread">Unread First</option>
          </select>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {error && (
          <div className="alert alert-error m-4">
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={reload}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="text-base-content/30 mb-4 h-16 w-16"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
              />
            </svg>
            <h3 className="mb-2 text-lg font-semibold">No conversations yet</h3>
            <p className="text-base-content/70 mb-4">
              {searchQuery
                ? 'No conversations match your search'
                : 'Start a conversation by connecting with someone'}
            </p>
            {!searchQuery && (
              <button
                className="btn btn-primary min-h-11"
                onClick={() => router.push('/messages?tab=connections')}
              >
                Find Connections
              </button>
            )}
          </div>
        )}

        {!loading && !error && conversations.length > 0 && (
          <div className="flex flex-col gap-1 p-2">
            {conversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversationId={conv.id}
                participant={conv.participant}
                lastMessage={conv.lastMessage}
                lastMessageAt={conv.lastMessageAt}
                unreadCount={conv.unreadCount}
                isArchived={conv.isArchived}
                isSelected={conv.id === selectedConversationId}
                onClick={() => handleConversationClick(conv.id)}
                onArchive={() => archiveConversation(conv.id)}
                onUnarchive={() => unarchiveConversation(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
