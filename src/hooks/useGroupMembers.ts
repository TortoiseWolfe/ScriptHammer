/**
 * useGroupMembers Hook
 * Feature 010: Group Chats
 * T027: Hook for member search/selection in group creation
 *
 * Responsibilities:
 * - Search connected users for member selection
 * - Manage selected member state
 * - Validate member constraints
 */

import { useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, ConnectionStatus } from '@/types/messaging';
import { GROUP_CONSTRAINTS } from '@/types/messaging';

interface ConnectedUser extends UserProfile {
  connectionId: string;
}

export interface UseGroupMembersReturn {
  /** List of connected users matching search query */
  searchResults: ConnectedUser[];
  /** Currently selected member IDs */
  selectedMembers: string[];
  /** Loading state for search */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Search for connected users */
  searchConnections: (query: string) => Promise<void>;
  /** Add a member to selection */
  addMember: (userId: string) => void;
  /** Remove a member from selection */
  removeMember: (userId: string) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if member limit reached */
  isAtCapacity: boolean;
  /** Number of remaining slots */
  remainingSlots: number;
  /** Get selected member profiles */
  getSelectedProfiles: () => ConnectedUser[];
}

/**
 * Hook for managing member selection in group creation
 * @param maxMembers - Maximum allowed members (default: GROUP_CONSTRAINTS.MAX_MEMBERS - 1)
 */
export function useGroupMembers(
  maxMembers: number = GROUP_CONSTRAINTS.MAX_MEMBERS - 1
): UseGroupMembersReturn {
  const [searchResults, setSearchResults] = useState<ConnectedUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allConnections, setAllConnections] = useState<ConnectedUser[]>([]);

  const supabase = useMemo(() => createClient(), []);

  /**
   * Fetch all accepted connections on mount
   */
  const loadConnections = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        return;
      }

      // Get all accepted connections
      const { data: connections, error: connError } = await supabase
        .from('user_connections')
        .select(
          `
          id,
          requester_id,
          addressee_id,
          requester:user_profiles!user_connections_requester_id_fkey(id, display_name, avatar_url),
          addressee:user_profiles!user_connections_addressee_id_fkey(id, display_name, avatar_url)
        `
        )
        .eq('status', 'accepted' as ConnectionStatus);

      if (connError) {
        setError('Failed to load connections');
        return;
      }

      // Map to connected users (the other person in each connection)
      const connectedUsers: ConnectedUser[] = (connections || []).map(
        (conn) => {
          const isRequester = conn.requester_id === user.id;
          const profile = isRequester ? conn.addressee : conn.requester;
          return {
            id: (profile as any).id,
            display_name: (profile as any).display_name,
            avatar_url: (profile as any).avatar_url,
            connectionId: conn.id,
          };
        }
      );

      setAllConnections(connectedUsers);
      setSearchResults(connectedUsers);
    } catch {
      setError('Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  /**
   * Search connections by display name
   */
  const searchConnections = useCallback(
    async (query: string) => {
      // Load connections if not already loaded
      if (allConnections.length === 0) {
        await loadConnections();
      }

      const trimmedQuery = query.trim().toLowerCase();

      if (!trimmedQuery) {
        setSearchResults(allConnections);
        return;
      }

      const filtered = allConnections.filter(
        (user) =>
          user.display_name?.toLowerCase().includes(trimmedQuery) ||
          user.id.toLowerCase().includes(trimmedQuery)
      );

      setSearchResults(filtered);
    },
    [allConnections, loadConnections]
  );

  /**
   * Add a member to selection
   */
  const addMember = useCallback(
    (userId: string) => {
      if (selectedMembers.length >= maxMembers) {
        setError(`Cannot add more than ${maxMembers} members`);
        return;
      }

      if (selectedMembers.includes(userId)) {
        return;
      }

      setSelectedMembers((prev) => [...prev, userId]);
      setError(null);
    },
    [selectedMembers, maxMembers]
  );

  /**
   * Remove a member from selection
   */
  const removeMember = useCallback((userId: string) => {
    setSelectedMembers((prev) => prev.filter((id) => id !== userId));
    setError(null);
  }, []);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedMembers([]);
    setError(null);
  }, []);

  /**
   * Get profiles for selected members
   */
  const getSelectedProfiles = useCallback((): ConnectedUser[] => {
    return allConnections.filter((user) => selectedMembers.includes(user.id));
  }, [allConnections, selectedMembers]);

  const isAtCapacity = selectedMembers.length >= maxMembers;
  const remainingSlots = maxMembers - selectedMembers.length;

  return {
    searchResults,
    selectedMembers,
    isLoading,
    error,
    searchConnections,
    addMember,
    removeMember,
    clearSelection,
    isAtCapacity,
    remainingSlots,
    getSelectedProfiles,
  };
}
