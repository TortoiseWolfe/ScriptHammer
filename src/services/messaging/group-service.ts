/**
 * Group Service - Manages group conversation operations
 * Feature 010: Group Chats
 *
 * Responsibilities:
 * - Create group conversations
 * - Add/remove members
 * - Transfer ownership
 * - Upgrade 1-to-1 to group
 * - Leave group
 * - Delete group
 */

import { createClient } from '@/lib/supabase/client';
import { createMessagingClient } from '@/lib/supabase/messaging-client';
import { GroupKeyService } from '@/services/messaging/group-key-service';
import { keyManagementService } from '@/services/messaging/key-service';
import { createLogger } from '@/lib/logger';
import type {
  CreateGroupInput,
  AddMembersInput,
  AddMembersResult,
  TransferOwnershipInput,
  UpgradeToGroupInput,
  GroupConversation,
  ConversationMember,
} from '@/types/messaging';
import {
  GROUP_CONSTRAINTS,
  MembershipError,
  GroupError,
  AuthenticationError,
  ValidationError,
} from '@/types/messaging';

const logger = createLogger('messaging:group');

/**
 * Result of group creation including conversation and members
 */
export interface CreateGroupResult {
  conversation: GroupConversation;
  members: ConversationMember[];
}

/**
 * GroupService handles all group conversation operations
 */
export class GroupService {
  private supabase = createClient();
  private groupKeyService = new GroupKeyService();

  /**
   * Create a new group conversation
   * T023: Validate members, create conversation with is_group=true, add conversation_members entries
   * T024: Generate key, encrypt for each member, store in group_keys
   * T025: Integrate key distribution into createGroup() flow
   *
   * @param input - Group creation parameters
   * @returns Created group conversation with members
   * @throws GroupError if creation fails
   * @throws MembershipError if member validation fails
   * @throws AuthenticationError if not authenticated
   */
  async createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthenticationError('You must be signed in to create a group');
    }

    const { name, member_ids } = input;

    // Validation: Check member count
    if (!member_ids || member_ids.length === 0) {
      throw new MembershipError(
        `Group must have at least ${GROUP_CONSTRAINTS.MIN_MEMBERS - 1} other members`,
        'AT_CAPACITY'
      );
    }

    // Total members = creator + member_ids
    const totalMembers = member_ids.length + 1;
    if (totalMembers > GROUP_CONSTRAINTS.MAX_MEMBERS) {
      throw new MembershipError(
        `Group cannot exceed ${GROUP_CONSTRAINTS.MAX_MEMBERS} members`,
        'AT_CAPACITY'
      );
    }

    // Validation: Check for duplicates
    const uniqueMembers = new Set(member_ids);
    if (uniqueMembers.size !== member_ids.length) {
      throw new ValidationError('Duplicate member IDs provided', 'member_ids');
    }

    // Validation: Check self not in member list
    if (member_ids.includes(user.id)) {
      throw new ValidationError(
        'Cannot add yourself as a member',
        'member_ids'
      );
    }

    // Validation: Check name length if provided
    if (name && name.length > GROUP_CONSTRAINTS.MAX_NAME_LENGTH) {
      throw new ValidationError(
        `Group name cannot exceed ${GROUP_CONSTRAINTS.MAX_NAME_LENGTH} characters`,
        'name'
      );
    }

    // Validation: Check all members are connected to creator
    const connectedUserIds = await this.getConnectedUserIds(
      user.id,
      member_ids
    );
    const unconnectedMembers = member_ids.filter(
      (id) => !connectedUserIds.has(id)
    );
    if (unconnectedMembers.length > 0) {
      throw new MembershipError(
        'All members must be connected to you',
        'NOT_CONNECTED'
      );
    }

    // Validation: Check creator has encryption keys loaded
    const currentKeys = keyManagementService.getCurrentKeys();
    if (!currentKeys) {
      throw new GroupError(
        'Encryption keys not available. Please unlock messaging first.'
      );
    }

    // Validation: Check all members have public keys (messaging set up)
    const memberKeyCheck = await this.validateMembersHaveKeys(member_ids);
    if (memberKeyCheck.missingKeys.length > 0) {
      throw new MembershipError(
        `Cannot create group: ${memberKeyCheck.missingKeys.length} member(s) have not set up messaging yet`,
        'NOT_CONNECTED'
      );
    }

    const msgClient = createMessagingClient(this.supabase);

    try {
      // Create group conversation
      const { data: conversation, error: convError } = await msgClient
        .from('conversations')
        .insert({
          is_group: true,
          group_name: name || null,
          created_by: user.id,
          current_key_version: 1,
          // participant_1_id and participant_2_id are NULL for groups
        })
        .select(
          'id, is_group, group_name, created_by, current_key_version, created_at, last_message_at'
        )
        .single();

      if (convError || !conversation) {
        throw new GroupError('Failed to create group conversation', convError);
      }

      // Create member entries (owner + members)
      const memberEntries = [
        // Creator as owner
        {
          conversation_id: conversation.id,
          user_id: user.id,
          role: 'owner' as const,
          key_version_joined: 1,
          key_status: 'active' as const,
        },
        // Other members
        ...member_ids.map((memberId) => ({
          conversation_id: conversation.id,
          user_id: memberId,
          role: 'member' as const,
          key_version_joined: 1,
          key_status: 'active' as const,
        })),
      ];

      const { data: members, error: membersError } = await msgClient
        .from('conversation_members')
        .insert(memberEntries)
        .select(
          'id, conversation_id, user_id, role, joined_at, left_at, key_version_joined, key_status, archived, muted'
        );

      if (membersError || !members) {
        // Rollback: delete conversation
        await msgClient
          .from('conversations')
          .delete()
          .eq('id', conversation.id);
        throw new GroupError('Failed to add group members', membersError);
      }

      // T024-T025: Distribute group key to all members
      const keyResult = await this.groupKeyService.distributeGroupKey(
        conversation.id,
        members as ConversationMember[],
        1 // Initial key version
      );

      // If no members received keys, fail the entire operation and rollback
      if (keyResult.successful.length === 0) {
        logger.error('Failed to distribute group key to any members', {
          conversationId: conversation.id,
          pending: keyResult.pending,
        });
        // Rollback: delete the conversation (cascade deletes members)
        await msgClient
          .from('conversations')
          .delete()
          .eq('id', conversation.id);
        throw new GroupError(
          'Failed to distribute encryption keys. Please try again.'
        );
      }

      // If some members are pending, log warning but continue
      if (keyResult.pending.length > 0) {
        logger.warn('Some members marked pending for key distribution', {
          conversationId: conversation.id,
          pending: keyResult.pending,
          successful: keyResult.successful,
        });
        // Update pending members' key_status
        await msgClient
          .from('conversation_members')
          .update({ key_status: 'pending' })
          .eq('conversation_id', conversation.id)
          .in('user_id', keyResult.pending);
      }

      logger.info('Group created', {
        conversationId: conversation.id,
        memberCount: members.length,
        groupName: name,
      });

      return {
        conversation: {
          id: conversation.id,
          is_group: true,
          group_name: conversation.group_name,
          created_by: conversation.created_by || user.id, // Guaranteed to exist since we just created it
          current_key_version: conversation.current_key_version,
          last_message_at: conversation.last_message_at,
          created_at: conversation.created_at,
        },
        members: members as ConversationMember[],
      };
    } catch (error) {
      if (
        error instanceof GroupError ||
        error instanceof MembershipError ||
        error instanceof ValidationError
      ) {
        throw error;
      }
      throw new GroupError('Failed to create group', error);
    }
  }

  /**
   * Get user IDs that have accepted connections with the current user
   * @private
   */
  private async getConnectedUserIds(
    currentUserId: string,
    targetUserIds: string[]
  ): Promise<Set<string>> {
    const { data: connections, error } = await this.supabase
      .from('user_connections')
      .select('requester_id, addressee_id')
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.in.(${targetUserIds.join(',')})),` +
          `and(addressee_id.eq.${currentUserId},requester_id.in.(${targetUserIds.join(',')}))`
      )
      .eq('status', 'accepted');

    if (error) {
      throw new GroupError('Failed to verify connections', error);
    }

    const connectedIds = new Set<string>();
    for (const conn of connections || []) {
      if (conn.requester_id === currentUserId) {
        connectedIds.add(conn.addressee_id);
      } else {
        connectedIds.add(conn.requester_id);
      }
    }

    return connectedIds;
  }

  /**
   * Validate that all members have encryption keys set up
   * @private
   */
  private async validateMembersHaveKeys(memberIds: string[]): Promise<{
    hasKeys: string[];
    missingKeys: string[];
  }> {
    const { data: keys, error } = await this.supabase
      .from('user_encryption_keys')
      .select('user_id')
      .in('user_id', memberIds);

    if (error) {
      logger.error('Failed to check member encryption keys', { error });
      throw new GroupError('Failed to verify member encryption status', error);
    }

    const usersWithKeys = new Set(keys?.map((k) => k.user_id) || []);
    return {
      hasKeys: memberIds.filter((id) => usersWithKeys.has(id)),
      missingKeys: memberIds.filter((id) => !usersWithKeys.has(id)),
    };
  }

  /**
   * Get the authenticated user or throw. Shared by the membership mutations.
   */
  private async requireUser(): Promise<{ id: string }> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();
    if (error || !user) {
      throw new AuthenticationError('You must be signed in');
    }
    return user;
  }

  /**
   * Record a group system message (member_added / member_removed / member_left /
   * ownership_transferred / group_renamed) for the audit trail. Best-effort: a
   * failure here is logged but never aborts the membership change it describes.
   */
  private async recordSystemMessage(
    conversationId: string,
    actorId: string,
    type: string,
    extra?: Record<string, unknown>
  ): Promise<void> {
    try {
      const msgClient = createMessagingClient(this.supabase);
      await msgClient.from('messages').insert({
        conversation_id: conversationId,
        sender_id: actorId,
        is_system_message: true,
        system_message_type: type,
        // System messages aren't E2E-encrypted; store a tiny JSON marker.
        encrypted_content: JSON.stringify({ type, ...extra }),
        initialization_vector: 'system',
      });
    } catch (error) {
      logger.warn('Failed to record group system message', {
        conversationId,
        type,
        error,
      });
    }
  }

  /**
   * Add members to an existing group (#26). Owner or existing member may add.
   * Distributes the current group key to the new members; members without a
   * public key are returned as `pending` (retryable via the key service).
   * @throws AuthenticationError / MembershipError / GroupError
   */
  async addMembers(input: AddMembersInput): Promise<AddMembersResult> {
    const user = await this.requireUser();
    const { conversation_id, member_ids } = input;

    if (!member_ids || member_ids.length === 0) {
      throw new ValidationError('No members provided', 'member_ids');
    }
    if (!(await this.isMember(conversation_id, user.id))) {
      throw new MembershipError(
        'Only a group member can add members',
        'NOT_CONNECTED'
      );
    }

    const msgClient = createMessagingClient(this.supabase);

    // Read the group's current key version + capacity.
    const { data: conversation, error: convError } = await msgClient
      .from('conversations')
      .select('id, is_group, current_key_version')
      .eq('id', conversation_id)
      .single();
    if (convError || !conversation || !conversation.is_group) {
      throw new GroupError('Group not found');
    }

    // Skip anyone already an active member; reject over-capacity.
    const newIds: string[] = [];
    for (const id of new Set(member_ids)) {
      if (id === user.id) continue;
      if (!(await this.isMember(conversation_id, id))) newIds.push(id);
    }
    if (newIds.length === 0) {
      return {
        added: [],
        pending: [],
        new_key_version: conversation.current_key_version,
      };
    }
    const currentCount = await this.getMemberCount(conversation_id);
    if (currentCount + newIds.length > GROUP_CONSTRAINTS.MAX_MEMBERS) {
      throw new MembershipError(
        `Group cannot exceed ${GROUP_CONSTRAINTS.MAX_MEMBERS} members`,
        'AT_CAPACITY'
      );
    }

    // New members must be connected to the actor and have messaging set up.
    const connected = await this.getConnectedUserIds(user.id, newIds);
    if (newIds.some((id) => !connected.has(id))) {
      throw new MembershipError(
        'All members must be connected to you',
        'NOT_CONNECTED'
      );
    }
    const keyCheck = await this.validateMembersHaveKeys(newIds);

    const keyVersion = conversation.current_key_version;
    const memberEntries = newIds.map((id) => ({
      conversation_id,
      user_id: id,
      role: 'member' as const,
      key_version_joined: keyVersion,
      key_status: keyCheck.missingKeys.includes(id)
        ? ('pending' as const)
        : ('active' as const),
    }));

    const { error: insertError } = await msgClient
      .from('conversation_members')
      .insert(memberEntries);
    if (insertError) {
      throw new GroupError('Failed to add members', insertError);
    }

    // Distribute the CURRENT key to the new members (no rotation needed on add —
    // new members legitimately may read history they now belong to).
    const withKeys = newIds.filter((id) => !keyCheck.missingKeys.includes(id));
    const memberRows: ConversationMember[] =
      await this.getMembers(conversation_id);
    const newMemberRows = memberRows.filter((m) =>
      withKeys.includes(m.user_id)
    );
    let pending = [...keyCheck.missingKeys];
    if (newMemberRows.length > 0) {
      const result = await this.groupKeyService.distributeGroupKey(
        conversation_id,
        newMemberRows,
        keyVersion
      );
      pending = [...pending, ...result.pending];
    }

    await this.recordSystemMessage(conversation_id, user.id, 'member_added', {
      added: newIds,
    });

    return {
      added: newIds,
      pending: Array.from(new Set(pending)),
      new_key_version: keyVersion,
    };
  }

  /**
   * Remove a member from a group (owner only) (#26). Soft-deletes the membership
   * then ROTATES the group key so the removed member loses access to future
   * messages (forward secrecy).
   * @throws AuthenticationError / MembershipError
   */
  async removeMember(conversationId: string, userId: string): Promise<void> {
    const user = await this.requireUser();
    if (!(await this.isOwner(conversationId, user.id))) {
      throw new MembershipError(
        'Only the group owner can remove members',
        'NOT_CONNECTED'
      );
    }
    if (userId === user.id) {
      throw new MembershipError(
        'Use leaveGroup to remove yourself',
        'NOT_CONNECTED'
      );
    }
    if (!(await this.isMember(conversationId, userId))) {
      throw new MembershipError('User is not a member', 'NOT_CONNECTED');
    }

    const msgClient = createMessagingClient(this.supabase);
    const { error } = await msgClient
      .from('conversation_members')
      .update({ left_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null);
    if (error) {
      throw new GroupError('Failed to remove member', error);
    }

    // Forward secrecy: rotate so the departed member can't read new messages.
    await this.groupKeyService.rotateGroupKey(conversationId);
    await this.recordSystemMessage(conversationId, user.id, 'member_removed', {
      removed: userId,
    });
  }

  /**
   * Leave a group voluntarily (#26). An owner must transfer ownership first
   * (unless they are the last member, in which case the group is deleted).
   * Rotates the key on departure for forward secrecy.
   * @throws AuthenticationError / MembershipError
   */
  async leaveGroup(conversationId: string): Promise<void> {
    const user = await this.requireUser();
    if (!(await this.isMember(conversationId, user.id))) {
      throw new MembershipError('You are not a member', 'NOT_CONNECTED');
    }

    if (await this.isOwner(conversationId, user.id)) {
      const count = await this.getMemberCount(conversationId);
      if (count > 1) {
        throw new MembershipError(
          'Transfer ownership before leaving the group',
          'NOT_CONNECTED'
        );
      }
      // Sole owner + last member → deleting is the only sensible outcome.
      await this.deleteGroup(conversationId);
      return;
    }

    const msgClient = createMessagingClient(this.supabase);
    const { error } = await msgClient
      .from('conversation_members')
      .update({ left_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .is('left_at', null);
    if (error) {
      throw new GroupError('Failed to leave group', error);
    }

    await this.groupKeyService.rotateGroupKey(conversationId);
    await this.recordSystemMessage(conversationId, user.id, 'member_left');
  }

  /**
   * Transfer group ownership to another active member (owner only) (#26).
   * Demotes the current owner to member and promotes the target.
   * @throws AuthenticationError / MembershipError
   */
  async transferOwnership(input: TransferOwnershipInput): Promise<void> {
    const user = await this.requireUser();
    const { conversation_id, new_owner_id } = input;

    if (!(await this.isOwner(conversation_id, user.id))) {
      throw new MembershipError(
        'Only the group owner can transfer ownership',
        'NOT_CONNECTED'
      );
    }
    if (new_owner_id === user.id) {
      throw new ValidationError('You are already the owner', 'new_owner_id');
    }
    if (!(await this.isMember(conversation_id, new_owner_id))) {
      throw new MembershipError(
        'New owner must be an active member',
        'NOT_CONNECTED'
      );
    }

    const msgClient = createMessagingClient(this.supabase);
    const { error: demoteError } = await msgClient
      .from('conversation_members')
      .update({ role: 'member' })
      .eq('conversation_id', conversation_id)
      .eq('user_id', user.id)
      .is('left_at', null);
    if (demoteError) {
      throw new GroupError('Failed to transfer ownership', demoteError);
    }
    const { error: promoteError } = await msgClient
      .from('conversation_members')
      .update({ role: 'owner' })
      .eq('conversation_id', conversation_id)
      .eq('user_id', new_owner_id)
      .is('left_at', null);
    if (promoteError) {
      // Best-effort rollback of the demotion to avoid an owner-less group.
      await msgClient
        .from('conversation_members')
        .update({ role: 'owner' })
        .eq('conversation_id', conversation_id)
        .eq('user_id', user.id)
        .is('left_at', null);
      throw new GroupError('Failed to transfer ownership', promoteError);
    }

    await this.recordSystemMessage(
      conversation_id,
      user.id,
      'ownership_transferred',
      { new_owner: new_owner_id }
    );
  }

  /**
   * Upgrade a 1-to-1 conversation to a group (#26). Converts the row to a group,
   * creates member entries for both original participants + any new members, and
   * distributes a fresh group key (version 1).
   * @throws AuthenticationError / MembershipError / GroupError
   */
  async upgradeToGroup(input: UpgradeToGroupInput): Promise<GroupConversation> {
    const user = await this.requireUser();
    const { conversation_id, name, member_ids } = input;

    const msgClient = createMessagingClient(this.supabase);
    const { data: conv, error: convError } = await msgClient
      .from('conversations')
      .select('id, is_group, participant_1_id, participant_2_id')
      .eq('id', conversation_id)
      .single();
    if (convError || !conv) {
      throw new GroupError('Conversation not found');
    }
    if (conv.is_group) {
      throw new ValidationError(
        'Conversation is already a group',
        'conversation_id'
      );
    }
    if (
      conv.participant_1_id !== user.id &&
      conv.participant_2_id !== user.id
    ) {
      throw new MembershipError(
        'You are not a participant in this conversation',
        'NOT_CONNECTED'
      );
    }
    const otherParticipant =
      conv.participant_1_id === user.id
        ? conv.participant_2_id
        : conv.participant_1_id;

    const newIds = Array.from(new Set(member_ids ?? [])).filter(
      (id) => id !== user.id && id !== otherParticipant
    );
    const connected = await this.getConnectedUserIds(user.id, newIds);
    if (newIds.some((id) => !connected.has(id))) {
      throw new MembershipError(
        'All members must be connected to you',
        'NOT_CONNECTED'
      );
    }

    // Convert the conversation row to a group.
    const { data: updated, error: updateError } = await msgClient
      .from('conversations')
      .update({
        is_group: true,
        group_name: name || null,
        created_by: user.id,
        current_key_version: 1,
        participant_1_id: null,
        participant_2_id: null,
      })
      .eq('id', conversation_id)
      .select(
        'id, is_group, group_name, created_by, current_key_version, created_at, last_message_at'
      )
      .single();
    if (updateError || !updated) {
      throw new GroupError('Failed to upgrade conversation', updateError);
    }

    // Member rows: actor=owner, the other participant + new members.
    const entries = [
      {
        conversation_id,
        user_id: user.id,
        role: 'owner' as const,
        key_version_joined: 1,
        key_status: 'active' as const,
      },
      ...(otherParticipant
        ? [
            {
              conversation_id,
              user_id: otherParticipant,
              role: 'member' as const,
              key_version_joined: 1,
              key_status: 'active' as const,
            },
          ]
        : []),
      ...newIds.map((id) => ({
        conversation_id,
        user_id: id,
        role: 'member' as const,
        key_version_joined: 1,
        key_status: 'active' as const,
      })),
    ];
    const { error: membersError } = await msgClient
      .from('conversation_members')
      .insert(entries);
    if (membersError) {
      throw new GroupError('Failed to add group members', membersError);
    }

    const memberRows = await this.getMembers(conversation_id);
    await this.groupKeyService.distributeGroupKey(
      conversation_id,
      memberRows,
      1
    );
    await this.recordSystemMessage(conversation_id, user.id, 'group_created');

    return updated as GroupConversation;
  }

  /**
   * Delete a group (owner only) (#26). Relies on FK cascades to drop
   * conversation_members, group_keys and messages.
   * @throws AuthenticationError / MembershipError
   */
  async deleteGroup(conversationId: string): Promise<void> {
    const user = await this.requireUser();
    if (!(await this.isOwner(conversationId, user.id))) {
      throw new MembershipError(
        'Only the group owner can delete the group',
        'NOT_CONNECTED'
      );
    }
    const msgClient = createMessagingClient(this.supabase);
    const { error } = await msgClient
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    if (error) {
      throw new GroupError('Failed to delete group', error);
    }
  }

  /**
   * Rename a group (owner only) (#26).
   * @throws AuthenticationError / MembershipError / ValidationError
   */
  async renameGroup(conversationId: string, newName: string): Promise<void> {
    const user = await this.requireUser();
    if (!(await this.isOwner(conversationId, user.id))) {
      throw new MembershipError(
        'Only the group owner can rename the group',
        'NOT_CONNECTED'
      );
    }
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new ValidationError('Group name cannot be empty', 'name');
    }
    if (trimmed.length > GROUP_CONSTRAINTS.MAX_NAME_LENGTH) {
      throw new ValidationError(
        `Group name cannot exceed ${GROUP_CONSTRAINTS.MAX_NAME_LENGTH} characters`,
        'name'
      );
    }
    const msgClient = createMessagingClient(this.supabase);
    const { error } = await msgClient
      .from('conversations')
      .update({ group_name: trimmed })
      .eq('id', conversationId);
    if (error) {
      throw new GroupError('Failed to rename group', error);
    }
    await this.recordSystemMessage(conversationId, user.id, 'group_renamed', {
      name: trimmed,
    });
  }

  /**
   * Get active group members with profiles (#26). RLS scopes visibility to
   * conversations the caller belongs to.
   */
  async getMembers(conversationId: string): Promise<ConversationMember[]> {
    const msgClient = createMessagingClient(this.supabase);
    const { data, error } = await msgClient
      .from('conversation_members')
      .select(
        'id, conversation_id, user_id, role, joined_at, left_at, key_version_joined, key_status, archived, muted'
      )
      .eq('conversation_id', conversationId)
      .is('left_at', null)
      .order('joined_at', { ascending: true });
    if (error) {
      throw new GroupError('Failed to load group members', error);
    }
    return (data ?? []) as ConversationMember[];
  }

  /**
   * Check if user is a member of the group
   * @param conversationId - Group ID
   * @param userId - User ID
   * @returns True if active member
   */
  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    return !!data;
  }

  /**
   * Check if user is the group owner
   * @param conversationId - Group ID
   * @param userId - User ID
   * @returns True if owner
   */
  async isOwner(conversationId: string, userId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    return data?.role === 'owner';
  }

  /**
   * Get member count for a group
   * @param conversationId - Group ID
   * @returns Number of active members
   */
  async getMemberCount(conversationId: string): Promise<number> {
    const { count } = await this.supabase
      .from('conversation_members')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .is('left_at', null);

    return count ?? 0;
  }

  /**
   * Generate auto-name from member display names
   * @param members - Member profiles
   * @returns Generated name like "Alice, Bob, Carol" or "Alice, Bob +5 others"
   */
  generateAutoName(members: { display_name: string | null }[]): string {
    const names = members
      .map((m) => m.display_name || 'Unknown')
      .filter(Boolean)
      .slice(0, 3);

    if (members.length <= 3) {
      return names.join(', ');
    }

    return `${names.slice(0, 2).join(', ')} +${members.length - 2} others`;
  }
}

// Export singleton instance
export const groupService = new GroupService();
