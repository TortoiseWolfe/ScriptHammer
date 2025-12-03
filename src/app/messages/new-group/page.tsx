'use client';

/**
 * New Group Page
 * Feature 010: Group Chats - Proper page-based UX
 *
 * Full-page flow for creating group conversations:
 * - Full viewport for member selection
 * - Mobile-first responsive layout
 * - Sticky search and action button
 * - Browser back button works naturally
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGroupMembers } from '@/hooks/useGroupMembers';
import { groupService } from '@/services/messaging/group-service';
import { GROUP_CONSTRAINTS } from '@/types/messaging';
import { MessagingGate } from '@/components/auth/MessagingGate';

function NewGroupContent() {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showSelected, setShowSelected] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    searchResults,
    selectedMembers,
    isLoading,
    error: searchError,
    searchConnections,
    addMember,
    removeMember,
    clearSelection,
    isAtCapacity,
    getSelectedProfiles,
  } = useGroupMembers();

  // Load initial connections on mount
  useEffect(() => {
    searchConnections('');
  }, [searchConnections]);

  // Handle search input
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      searchConnections(query);
    },
    [searchConnections]
  );

  // Handle group creation
  const handleCreate = useCallback(async () => {
    if (selectedMembers.length === 0) {
      setCreateError('Please select at least one member');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await groupService.createGroup({
        name: groupName.trim() || undefined,
        member_ids: selectedMembers,
      });

      // Navigate to the new group conversation
      router.push(`/messages?conversation=${result.conversation.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create group'
      );
      setIsCreating(false);
    }
  }, [selectedMembers, groupName, router]);

  // Generate auto-name preview
  const autoNamePreview = (() => {
    const profiles = getSelectedProfiles();
    if (profiles.length === 0)
      return 'Will be auto-generated from member names';
    const names = profiles.slice(0, 3).map((p) => p.display_name || 'Unknown');
    if (profiles.length <= 3) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${profiles.length - 2} others`;
  })();

  const selectedProfiles = getSelectedProfiles();
  const availableConnections = searchResults.filter(
    (user) => !selectedMembers.includes(user.id)
  );

  return (
    <div className="bg-base-100 flex h-full flex-col">
      {/* Header */}
      <header className="navbar border-base-300 shrink-0 border-b px-4">
        <div className="flex-none">
          <Link
            href="/messages"
            className="btn btn-ghost btn-sm min-h-11 gap-2"
            aria-label="Back to messages"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold">New Group</h1>
        </div>
        <div className="w-16 flex-none" /> {/* Spacer for centering */}
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg p-4">
          {/* Group Name Input */}
          <div className="form-control mb-6">
            <label htmlFor="group-name" className="label">
              <span className="label-text font-medium">Group Name</span>
              <span className="label-text-alt text-base-content/60">
                {groupName.length}/{GROUP_CONSTRAINTS.MAX_NAME_LENGTH}
              </span>
            </label>
            <input
              id="group-name"
              type="text"
              placeholder="Enter group name (optional)"
              className="input input-bordered min-h-12 w-full"
              value={groupName}
              onChange={(e) =>
                setGroupName(
                  e.target.value.slice(0, GROUP_CONSTRAINTS.MAX_NAME_LENGTH)
                )
              }
              disabled={isCreating}
            />
            <p className="label-text-alt text-base-content/60 mt-2">
              {autoNamePreview}
            </p>
          </div>

          {/* Selected Members Section */}
          {selectedMembers.length > 0 && (
            <div className="mb-6">
              <div
                role="button"
                tabIndex={0}
                className="flex w-full cursor-pointer items-center justify-between py-2"
                onClick={() => setShowSelected(!showSelected)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowSelected(!showSelected);
                  }
                }}
                aria-expanded={showSelected}
              >
                <span className="font-medium">
                  Selected ({selectedMembers.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelection();
                    }}
                  >
                    Clear all
                  </button>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 transition-transform ${showSelected ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {showSelected && (
                <div
                  className="mt-2 flex flex-wrap gap-2"
                  role="list"
                  aria-label="Selected members"
                >
                  {selectedProfiles.map((member) => (
                    <div
                      key={member.id}
                      role="listitem"
                      className="badge badge-primary gap-2 px-3 py-3"
                    >
                      <span className="max-w-[150px] truncate">
                        {member.display_name || 'Unknown'}
                      </span>
                      <button
                        type="button"
                        className="hover:bg-primary-focus rounded-full p-0.5"
                        onClick={() => removeMember(member.id)}
                        disabled={isCreating}
                        aria-label={`Remove ${member.display_name || 'Unknown'}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Input */}
          <div className="form-control mb-4">
            <label htmlFor="member-search" className="label">
              <span className="label-text font-medium">Add Members</span>
              <span className="label-text-alt">
                {selectedMembers.length}/{GROUP_CONSTRAINTS.MAX_MEMBERS - 1}{' '}
                selected
              </span>
            </label>
            <div className="relative">
              <input
                id="member-search"
                ref={searchInputRef}
                type="text"
                placeholder="Search your connections..."
                className="input input-bordered min-h-12 w-full pl-10"
                value={searchQuery}
                onChange={handleSearchChange}
                disabled={isCreating || isAtCapacity}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="text-base-content/40 absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {isAtCapacity && (
              <p className="label-text-alt text-warning mt-1">
                Maximum members reached
              </p>
            )}
          </div>

          {/* Available Connections List */}
          <div
            className="border-base-300 overflow-hidden rounded-lg border"
            role="listbox"
            aria-label="Available connections"
          >
            {isLoading ? (
              <div className="flex justify-center p-8">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : availableConnections.length === 0 ? (
              <div className="text-base-content/60 p-8 text-center">
                {searchQuery
                  ? 'No connections found'
                  : selectedMembers.length === searchResults.length
                    ? 'All connections selected'
                    : 'No connections available'}
              </div>
            ) : (
              <div className="divide-base-200 divide-y">
                {availableConnections.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="hover:bg-base-200 flex min-h-14 w-full items-center gap-4 p-4 text-left transition-colors"
                    onClick={() => addMember(user.id)}
                    disabled={isCreating || isAtCapacity}
                  >
                    <div className="avatar placeholder">
                      <div className="bg-neutral text-neutral-content h-10 w-10 rounded-full">
                        {user.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">
                            {(user.display_name || '?')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {user.display_name || 'Unknown'}
                      </p>
                      {user.username && (
                        <p className="text-base-content/60 truncate text-sm">
                          @{user.username}
                        </p>
                      )}
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-base-content/40 h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error Messages */}
          {(searchError || createError) && (
            <div className="alert alert-error mt-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{searchError || createError}</span>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Footer */}
      <footer className="border-base-300 bg-base-100 shrink-0 border-t p-4">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            className="btn btn-primary min-h-12 w-full"
            onClick={handleCreate}
            disabled={isCreating || selectedMembers.length === 0}
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Creating Group...
              </>
            ) : (
              `Create Group${selectedMembers.length > 0 ? ` (${selectedMembers.length + 1} members)` : ''}`
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function NewGroupPage() {
  return (
    <MessagingGate>
      <div className="fixed inset-x-0 top-16 bottom-28">
        <NewGroupContent />
      </div>
    </MessagingGate>
  );
}
