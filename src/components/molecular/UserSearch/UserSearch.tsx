'use client';

import React, { useState } from 'react';
import { connectionService } from '@/services/messaging/connection-service';
import type { UserProfile } from '@/types/messaging';
import { ValidationError } from '@/types/messaging';

export interface UserSearchProps {
  onRequestSent?: (userId: string) => void;
  className?: string;
}

export default function UserSearch({
  onRequestSent,
  className = '',
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [alreadyConnected, setAlreadyConnected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSearchPerformed(false);

    if (query.trim().length < 3) {
      setError('Search query must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await connectionService.searchUsers({
        query: query.trim(),
        limit: 10,
      });

      setResults(result.users);
      setAlreadyConnected(result.already_connected);
      setSearchPerformed(true);

      if (result.users.length === 0) {
        setError('No users found matching your search');
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError('Failed to search users. Please try again.');
      }
      setResults([]);
      setAlreadyConnected([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (addresseeId: string) => {
    setError(null);
    setSuccessMessage(null);
    setSendingRequest(addresseeId);

    try {
      await connectionService.sendFriendRequest({
        addressee_id: addresseeId,
      });

      setSuccessMessage('Friend request sent successfully!');
      setAlreadyConnected([...alreadyConnected, addresseeId]);

      if (onRequestSent) {
        onRequestSent(addresseeId);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send friend request';
      setError(message);
    } finally {
      setSendingRequest(null);
    }
  };

  const isConnected = (userId: string) => alreadyConnected.includes(userId);

  return (
    <div
      className={`user-search${className ? ` ${className}` : ''}`}
      data-testid="user-search"
    >
      <form onSubmit={handleSearch} className="mb-6">
        <div className="form-control">
          <label htmlFor="user-search-input" className="label">
            <span className="label-text">Search for users by name</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <input
              id="user-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter name"
              className="input input-bordered min-h-11 flex-1"
              aria-label="Search for users"
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary min-h-11 min-w-11 sm:w-auto"
              disabled={loading || query.trim().length < 3}
              aria-label="Search"
            >
              {loading ? <>Searching...</> : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success mb-4" role="alert">
          <span>{successMessage}</span>
        </div>
      )}

      {searchPerformed && results.length > 0 && (
        <div data-testid="search-results">
          <h3 className="mb-4 text-lg font-semibold">Search Results</h3>
          <div className="space-y-3">
            {results.map((user) => (
              <div
                key={user.id}
                className="card bg-base-200"
                data-testid="search-result-item"
              >
                <div className="card-body p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="avatar placeholder">
                        <div className="bg-neutral text-neutral-content w-12 rounded-full">
                          {user.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.avatar_url}
                              alt={user.display_name || 'User'}
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xl">
                              {(user.display_name || 'U')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold">
                          {user.display_name || 'Unknown User'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendRequest(user.id)}
                      disabled={
                        isConnected(user.id) || sendingRequest === user.id
                      }
                      className="btn btn-primary min-h-11 min-w-11 sm:w-auto"
                    >
                      {sendingRequest === user.id
                        ? 'Sending...'
                        : isConnected(user.id)
                          ? 'Request Sent'
                          : 'Send Request'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
