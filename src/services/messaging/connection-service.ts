/**
 * Connection Service for Friend Request Management
 * Tasks: T015-T021
 *
 * Implements IConnectionService interface for managing user connections
 */

import { createClient } from '@/lib/supabase/client';
import {
  createMessagingClient,
  type UserConnectionRow,
  type ConversationRow,
  type ConnectionStatus,
  type UserConnectionInsert,
  type UserConnectionUpdate,
  type ConversationInsert,
} from '@/lib/supabase/messaging-client';
import {
  validateEmail,
  sanitizeInput,
  validateUUID,
} from '@/lib/messaging/validation';
import type {
  UserConnection,
  SendFriendRequestInput,
  RespondToRequestInput,
  ConnectionList,
  SearchUsersInput,
  SearchUsersResult,
  UserProfile,
  ConnectionRequest,
} from '@/types/messaging';
import {
  AuthenticationError,
  ConnectionError,
  ValidationError,
} from '@/types/messaging';

export class ConnectionService {
  /**
   * Send a friend request to another user
   * Task: T017
   *
   * Creates a new pending friend request. Validates that the requester and addressee
   * are different users and that no existing connection exists between them.
   *
   * @param input - SendFriendRequestInput containing the addressee user ID
   * @param input.addressee_id - UUID of the user to send the request to
   * @returns Promise<UserConnection> - The created connection record with status 'pending'
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if addressee_id is invalid UUID or user attempts self-connection
   * @throws ConnectionError if connection already exists (any status) or request fails
   *
   * @example
   * ```typescript
   * const connection = await connectionService.sendFriendRequest({
   *   addressee_id: '123e4567-e89b-12d3-a456-426614174000'
   * });
   * ```
   */
  async sendFriendRequest(
    input: SendFriendRequestInput
  ): Promise<UserConnection> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Validate UUID format
    validateUUID(input.addressee_id, 'addressee_id');

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to send friend requests'
      );
    }

    const addressee_id = input.addressee_id;

    // Prevent self-connection
    if (addressee_id === user.id) {
      throw new ValidationError(
        'You cannot send a friend request to yourself',
        'addressee_id'
      );
    }

    // Check for existing connection (any status)
    const { data: existing } = await msgClient
      .from('user_connections')
      .select('*')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${user.id})`
      )
      .limit(1)
      .returns<UserConnectionRow[]>();

    if (existing && existing.length > 0) {
      const existingConnection = existing[0];
      if (existingConnection.status === 'pending') {
        throw new ConnectionError('Friend request already sent or received');
      } else if (existingConnection.status === 'accepted') {
        throw new ConnectionError('You are already connected with this user');
      } else if (existingConnection.status === 'blocked') {
        throw new ConnectionError('Cannot send request to this user');
      }
    }

    // Insert new connection request
    const insertData: UserConnectionInsert = {
      requester_id: user.id,
      addressee_id,
      status: 'pending',
    };

    const { data, error } = await (msgClient as any)
      .from('user_connections')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new ConnectionError(
        'Failed to send friend request: ' + error.message
      );
    }

    return data as UserConnection;
  }

  /**
   * Respond to a friend request with accept, decline, or block
   * Task: T018
   *
   * Updates a pending friend request status. Only the addressee (recipient) can respond.
   * Validates that the request exists, is still pending, and user is authorized to respond.
   *
   * @param input - RespondToRequestInput containing connection ID and action
   * @param input.connection_id - UUID of the friend request to respond to
   * @param input.action - Response action: 'accept' | 'decline' | 'block'
   * @returns Promise<UserConnection> - Updated connection record with new status
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if connection not found, already responded to, or user is not addressee
   * @throws ConnectionError if database update fails
   *
   * @example
   * ```typescript
   * // Accept a friend request
   * const connection = await connectionService.respondToRequest({
   *   connection_id: '123e4567-e89b-12d3-a456-426614174000',
   *   action: 'accept'
   * });
   * ```
   */
  async respondToRequest(
    input: RespondToRequestInput
  ): Promise<UserConnection> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Validate connection_id
    validateUUID(input.connection_id, 'connection_id');

    // Validate action
    if (!['accept', 'decline', 'block'].includes(input.action)) {
      throw new ValidationError(
        'Action must be accept, decline, or block',
        'action'
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to respond to friend requests'
      );
    }

    // Get the connection
    const { data: connection, error: fetchError } = await msgClient
      .from('user_connections')
      .select('*')
      .eq('id', input.connection_id)
      .single<UserConnectionRow>();

    if (fetchError || !connection) {
      throw new ValidationError('Friend request not found', 'connection_id');
    }

    // Verify user is the addressee
    if (connection.addressee_id !== user.id) {
      throw new ValidationError(
        'You can only respond to requests sent to you',
        'connection_id'
      );
    }

    // Verify status is pending
    if (connection.status !== 'pending') {
      throw new ValidationError(
        `Request already ${connection.status}`,
        'connection_id'
      );
    }

    // Map action to status
    const statusMap: Record<string, ConnectionStatus> = {
      accept: 'accepted',
      decline: 'declined',
      block: 'blocked',
    };

    const newStatus = statusMap[input.action];

    // Update connection status
    const updateData: UserConnectionUpdate = {
      status: newStatus,
    };

    const { data, error } = await (msgClient as any)
      .from('user_connections')
      .update(updateData)
      .eq('id', input.connection_id)
      .select()
      .single();

    if (error) {
      throw new ConnectionError(
        'Failed to respond to friend request: ' + error.message
      );
    }

    return data as UserConnection;
  }

  /**
   * Search for users by display_name with partial matching
   * Task: T019
   *
   * Searches the user_profiles table for users matching the query (partial match on
   * display_name). Returns users with their connection status relative
   * to the current user. Excludes the current user from results.
   *
   * @param input - SearchUsersInput containing search parameters
   * @param input.query - Text to search for (partial match, minimum 3 characters)
   * @param input.limit - Maximum number of results (default: 10)
   * @returns Promise<SearchUsersResult> - Matching users and list of already connected user IDs
   * @returns {UserProfile[]} users - Array of matching user profiles
   * @returns {string[]} already_connected - User IDs already connected with current user
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if query is less than 3 characters
   * @throws ConnectionError if database query fails
   *
   * @example
   * ```typescript
   * const result = await connectionService.searchUsers({
   *   query: 'john',  // Matches "johndoe", "John Smith", etc.
   *   limit: 5
   * });
   *
   * // Filter out already connected users
   * const newUsers = result.users.filter(
   *   user => !result.already_connected.includes(user.id)
   * );
   * ```
   */
  async searchUsers(input: SearchUsersInput): Promise<SearchUsersResult> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Sanitize query
    const query = sanitizeInput(input.query);

    if (query.length < 3) {
      throw new ValidationError(
        'Search query must be at least 3 characters',
        'query'
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to search for users'
      );
    }

    // Search for users by display_name (partial match, case-insensitive)
    // Uses ilike for PostgreSQL case-insensitive pattern matching
    const searchPattern = `%${query}%`;
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', searchPattern)
      .neq('id', user.id) // Exclude current user from results
      .limit(input.limit || 10);

    if (error) {
      throw new ConnectionError('Failed to search users: ' + error.message);
    }

    // Get existing connections for current user
    const { data: connections } = await msgClient
      .from('user_connections')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .returns<Pick<UserConnectionRow, 'requester_id' | 'addressee_id'>[]>();

    // Build list of already connected user IDs
    const connectedUserIds = new Set<string>();
    connections?.forEach((conn) => {
      if (conn.requester_id === user.id) {
        connectedUserIds.add(conn.addressee_id);
      } else {
        connectedUserIds.add(conn.requester_id);
      }
    });

    return {
      users: profiles || [],
      already_connected: Array.from(connectedUserIds),
    };
  }

  /**
   * Get all connections for the authenticated user, categorized by status
   * Task: T020
   *
   * Retrieves all friend connections and requests involving the current user.
   * Results are categorized into pending (sent/received), accepted, and blocked.
   * Includes full user profiles for both requester and addressee via FK joins.
   *
   * @returns Promise<ConnectionList> - Categorized connection lists with user profiles
   * @returns {ConnectionRequest[]} pending_sent - Requests sent by current user (awaiting response)
   * @returns {ConnectionRequest[]} pending_received - Requests received by current user (need response)
   * @returns {ConnectionRequest[]} accepted - Active friendships (both users connected)
   * @returns {ConnectionRequest[]} blocked - Blocked users
   * @throws AuthenticationError if user is not signed in
   * @throws ConnectionError if database query fails
   *
   * @example
   * ```typescript
   * const connections = await connectionService.getConnections();
   *
   * console.log(`Pending requests to respond: ${connections.pending_received.length}`);
   * console.log(`Active friendships: ${connections.accepted.length}`);
   * ```
   */
  async getConnections(): Promise<ConnectionList> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to view connections'
      );
    }

    // Fetch all connections with user profiles via FK joins
    const { data: connections, error } = await msgClient
      .from('user_connections')
      .select(
        `
        *,
        requester:user_profiles!requester_id (
          id, display_name, avatar_url
        ),
        addressee:user_profiles!addressee_id (
          id, display_name, avatar_url
        )
      `
      )
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) {
      throw new ConnectionError(
        'Failed to fetch connections: ' + error.message
      );
    }

    // Categorize connections
    const pending_sent: ConnectionRequest[] = [];
    const pending_received: ConnectionRequest[] = [];
    const accepted: ConnectionRequest[] = [];
    const blocked: ConnectionRequest[] = [];

    connections?.forEach((conn: any) => {
      const connectionRequest: ConnectionRequest = {
        connection: conn as UserConnection,
        requester: conn.requester as UserProfile,
        addressee: conn.addressee as UserProfile,
      };

      if (conn.status === 'pending') {
        if (conn.requester_id === user.id) {
          pending_sent.push(connectionRequest);
        } else {
          pending_received.push(connectionRequest);
        }
      } else if (conn.status === 'accepted') {
        accepted.push(connectionRequest);
      } else if (conn.status === 'blocked') {
        blocked.push(connectionRequest);
      }
    });

    return {
      pending_sent,
      pending_received,
      accepted,
      blocked,
    };
  }

  /**
   * Remove a connection or cancel a pending request
   * Task: T021
   *
   * Deletes a connection record from the database. Can be used to:
   * - Cancel a pending request you sent
   * - Remove an accepted friendship
   * - Unblock a blocked user
   *
   * Validates that the current user is either the requester or addressee before deletion.
   *
   * @param connection_id - UUID of the connection to remove
   * @returns Promise<void> - Resolves when connection is deleted
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if connection not found or user not involved in connection
   * @throws ConnectionError if database deletion fails
   *
   * @example
   * ```typescript
   * // Cancel a pending friend request
   * await connectionService.removeConnection(connectionId);
   *
   * // Unfriend someone
   * await connectionService.removeConnection(connectionId);
   * ```
   */
  async removeConnection(connection_id: string): Promise<void> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Validate connection_id
    validateUUID(connection_id, 'connection_id');

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to remove connections'
      );
    }

    // Get the connection
    const { data: connection, error: fetchError } = await msgClient
      .from('user_connections')
      .select('*')
      .eq('id', connection_id)
      .single<UserConnectionRow>();

    if (fetchError || !connection) {
      throw new ValidationError('Connection not found', 'connection_id');
    }

    // Verify user is involved in this connection
    if (
      connection.requester_id !== user.id &&
      connection.addressee_id !== user.id
    ) {
      throw new ValidationError(
        'You can only remove your own connections',
        'connection_id'
      );
    }

    // Delete the connection
    const { error } = await msgClient
      .from('user_connections')
      .delete()
      .eq('id', connection_id);

    if (error) {
      throw new ConnectionError(
        'Failed to remove connection: ' + error.message
      );
    }
  }

  /**
   * Get existing conversation or create a new one between current user and another user.
   * Task: T003 - Feature 037 Unified Messaging Sidebar
   *
   * Looks up an existing conversation between the two users. If none exists, creates
   * a new one. Enforces canonical ordering (smaller UUID = participant_1_id) to prevent
   * duplicate conversations. Handles race conditions via database unique constraint.
   *
   * @param otherUserId - UUID of the other participant
   * @returns Promise<string> - Conversation ID (existing or newly created)
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if otherUserId is invalid UUID
   * @throws ConnectionError if users are not connected (accepted status required)
   *
   * @example
   * ```typescript
   * // Get or create conversation with a connected user
   * const conversationId = await connectionService.getOrCreateConversation(
   *   '123e4567-e89b-12d3-a456-426614174000'
   * );
   * // Navigate to conversation
   * router.push(`/messages?conversation=${conversationId}`);
   * ```
   */
  async getOrCreateConversation(otherUserId: string): Promise<string> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Validate UUID format
    validateUUID(otherUserId, 'otherUserId');

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to start a conversation'
      );
    }

    // Prevent self-conversation
    if (otherUserId === user.id) {
      throw new ValidationError(
        'You cannot start a conversation with yourself',
        'otherUserId'
      );
    }

    // Verify connection is accepted
    const { data: connection } = await msgClient
      .from('user_connections')
      .select('status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`
      )
      .eq('status', 'accepted')
      .single<Pick<UserConnectionRow, 'status'>>();

    if (!connection) {
      throw new ConnectionError(
        'You must be connected with this user to start a conversation'
      );
    }

    // Apply canonical ordering (smaller UUID = participant_1_id)
    const [participant_1, participant_2] =
      user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

    // Check for existing conversation
    const { data: existing } = await msgClient
      .from('conversations')
      .select('id')
      .eq('participant_1_id', participant_1)
      .eq('participant_2_id', participant_2)
      .single<Pick<ConversationRow, 'id'>>();

    if (existing) {
      return existing.id;
    }

    // Create new conversation
    const insertData: ConversationInsert = {
      participant_1_id: participant_1,
      participant_2_id: participant_2,
    };

    const { data: created, error: createError } = await (msgClient as any)
      .from('conversations')
      .insert(insertData)
      .select('id')
      .single();

    if (createError) {
      // Handle race condition - conversation may have been created by other user
      if (createError.code === '23505') {
        // unique_violation
        const { data: retry } = await msgClient
          .from('conversations')
          .select('id')
          .eq('participant_1_id', participant_1)
          .eq('participant_2_id', participant_2)
          .single<Pick<ConversationRow, 'id'>>();
        if (retry) return retry.id;
      }
      throw new ConnectionError(
        'Failed to create conversation: ' + createError.message
      );
    }

    return created.id;
  }
}

// Export singleton instance
export const connectionService = new ConnectionService();
