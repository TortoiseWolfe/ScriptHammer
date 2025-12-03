/**
 * CreateGroupModal Component
 * Feature 010: Group Chats
 * T026, T028: Modal for creating new group conversations
 *
 * Features:
 * - Member search and selection
 * - Group name input
 * - Auto-name generation from first 3 members (FR-012)
 * - Validation and error handling
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGroupMembers } from '@/hooks/useGroupMembers';
import { groupService } from '@/services/messaging/group-service';
import { GROUP_CONSTRAINTS } from '@/types/messaging';

export interface CreateGroupModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when group is successfully created */
  onGroupCreated?: (conversationId: string) => void;
}

/**
 * Modal for creating new group conversations
 */
export function CreateGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
    remainingSlots,
    getSelectedProfiles,
  } = useGroupMembers();

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      // Load initial connections
      searchConnections('');
    }
  }, [isOpen, searchConnections]);

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

      // Reset state
      setGroupName('');
      setSearchQuery('');
      clearSelection();
      onClose();
      onGroupCreated?.(result.conversation.id);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create group'
      );
    } finally {
      setIsCreating(false);
    }
  }, [selectedMembers, groupName, clearSelection, onClose, onGroupCreated]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (!isCreating) {
      setGroupName('');
      setSearchQuery('');
      clearSelection();
      setCreateError(null);
      onClose();
    }
  }, [isCreating, clearSelection, onClose]);

  // Generate auto-name preview
  const autoNamePreview = (() => {
    const profiles = getSelectedProfiles();
    if (profiles.length === 0) return 'Group name (optional)';
    const names = profiles.slice(0, 3).map((p) => p.display_name || 'Unknown');
    if (profiles.length <= 3) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${profiles.length - 2} others`;
  })();

  if (!isOpen) return null;

  return (
    <dialog
      open
      className="modal modal-open"
      aria-labelledby="create-group-title"
      aria-modal="true"
    >
      <div className="modal-box max-w-md">
        <h3 id="create-group-title" className="mb-4 text-lg font-bold">
          New Group
        </h3>

        {/* Group Name Input */}
        <div className="form-control mb-4">
          <label htmlFor="group-name" className="label">
            <span className="label-text">Group Name</span>
            <span className="label-text-alt text-base-content/60">
              {groupName.length}/{GROUP_CONSTRAINTS.MAX_NAME_LENGTH}
            </span>
          </label>
          <input
            id="group-name"
            type="text"
            placeholder={autoNamePreview}
            className="input input-bordered w-full"
            value={groupName}
            onChange={(e) =>
              setGroupName(
                e.target.value.slice(0, GROUP_CONSTRAINTS.MAX_NAME_LENGTH)
              )
            }
            disabled={isCreating}
            aria-describedby="group-name-hint"
          />
          <p
            id="group-name-hint"
            className="label-text-alt text-base-content/60 mt-1"
          >
            Leave empty to auto-generate from member names
          </p>
        </div>

        {/* Member Search */}
        <div className="form-control mb-4">
          <label htmlFor="member-search" className="label">
            <span className="label-text">Add Members</span>
            <span className="label-text-alt">
              {selectedMembers.length}/{GROUP_CONSTRAINTS.MAX_MEMBERS - 1}{' '}
              selected
            </span>
          </label>
          <input
            id="member-search"
            ref={searchInputRef}
            type="text"
            placeholder="Search connections..."
            className="input input-bordered w-full"
            value={searchQuery}
            onChange={handleSearchChange}
            disabled={isCreating || isAtCapacity}
            aria-describedby="search-hint"
          />
          {isAtCapacity && (
            <p id="search-hint" className="label-text-alt text-warning mt-1">
              Maximum members reached
            </p>
          )}
        </div>

        {/* Selected Members Chips */}
        {selectedMembers.length > 0 && (
          <div
            className="mb-4 flex flex-wrap gap-2"
            role="list"
            aria-label="Selected members"
          >
            {getSelectedProfiles().map((member) => (
              <div
                key={member.id}
                role="listitem"
                className="badge badge-primary gap-1 py-3"
              >
                <span className="max-w-[120px] truncate">
                  {member.display_name || 'Unknown'}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs min-h-0 min-w-0 p-0"
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

        {/* Search Results */}
        <div
          className="border-base-300 mb-4 max-h-48 overflow-y-auto rounded-lg border"
          role="listbox"
          aria-label="Available connections"
        >
          {isLoading ? (
            <div className="flex justify-center p-4">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-base-content/60 p-4 text-center">
              {searchQuery
                ? 'No connections found'
                : 'No connections available'}
            </p>
          ) : (
            searchResults
              .filter((user) => !selectedMembers.includes(user.id))
              .map((user) => (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="hover:bg-base-200 border-base-200 flex min-h-11 w-full items-center gap-3 border-b p-3 transition-colors last:border-b-0"
                  onClick={() => addMember(user.id)}
                  disabled={isCreating || isAtCapacity}
                >
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content h-8 w-8 rounded-full">
                      {user.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm">
                          {(user.display_name || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="flex-1 truncate text-left">
                    {user.display_name || 'Unknown'}
                  </span>
                </button>
              ))
          )}
        </div>

        {/* Error Messages */}
        {(searchError || createError) && (
          <div className="alert alert-error mb-4">
            <span>{searchError || createError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost min-h-11 min-w-11"
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            onClick={handleCreate}
            disabled={isCreating || selectedMembers.length === 0}
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Creating...
              </>
            ) : (
              `Create Group${selectedMembers.length > 0 ? ` (${selectedMembers.length + 1})` : ''}`
            )}
          </button>
        </div>
      </div>

      {/* Modal Backdrop */}
      <div className="modal-backdrop" onClick={handleClose}>
        <button
          type="button"
          className="cursor-default"
          aria-label="Close modal"
        >
          close
        </button>
      </div>
    </dialog>
  );
}
