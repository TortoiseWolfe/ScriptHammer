/**
 * Message Service for Encrypted Messaging
 * Tasks: T060-T065
 *
 * Handles encrypted message operations:
 * - Send encrypted messages to connections
 * - Retrieve and decrypt message history
 * - Mark messages as read/delivered
 */

import { createClient } from '@/lib/supabase/client';
import { encryptionService } from '@/lib/messaging/encryption';
import { keyManagementService } from './key-service';
import { offlineQueueService } from './offline-queue-service';
import { cacheService } from '@/lib/messaging/cache';
import type {
  SendMessageInput,
  SendMessageResult,
  Message,
  MessageHistory,
  DecryptedMessage,
  UserProfile,
  EditMessageInput,
} from '@/types/messaging';
import {
  AuthenticationError,
  EncryptionError,
  EncryptionLockedError,
  ConnectionError,
  ValidationError,
  MESSAGE_CONSTRAINTS,
} from '@/types/messaging';

export class MessageService {
  /**
   * Send an encrypted message to a connection
   * Task: T061, T157 (updated for offline queue)
   *
   * Flow:
   * 1. Check if online (navigator.onLine)
   * 2. Initialize sender's keys if needed (lazy generation)
   * 3. Get recipient's public key
   * 4. Encrypt message content
   * 5. If offline: queue message for later sync
   * 6. If online: insert encrypted message to database
   * 7. On send failure: queue message with retry
   * 8. Return result
   *
   * @param input - SendMessageInput
   * @returns Promise<SendMessageResult> - Message and queued status
   * @throws AuthenticationError if not authenticated
   * @throws ValidationError if message invalid or recipient has no keys
   * @throws EncryptionError if encryption fails
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const supabase = createClient();

    // Validate message content
    const content = input.content.trim();

    if (content.length < MESSAGE_CONSTRAINTS.MIN_LENGTH) {
      throw new ValidationError('Message cannot be empty', 'content');
    }

    if (content.length > MESSAGE_CONSTRAINTS.MAX_LENGTH) {
      throw new ValidationError(
        `Message cannot exceed ${MESSAGE_CONSTRAINTS.MAX_LENGTH} characters`,
        'content'
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError('You must be signed in to send messages');
    }

    try {
      // Get sender's derived keys from memory (derived on login)
      const senderKeys = keyManagementService.getCurrentKeys();
      if (!senderKeys) {
        throw new EncryptionLockedError(
          'Your encryption keys are not available. Please sign in again to send messages.'
        );
      }

      // Get conversation details
      const { data: conversation, error: convError } = await (supabase as any)
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', input.conversation_id)
        .single();

      if (convError || !conversation) {
        throw new ValidationError('Conversation not found', 'conversation_id');
      }

      // Determine recipient ID
      const recipientId =
        conversation.participant_1_id === user.id
          ? conversation.participant_2_id
          : conversation.participant_1_id;

      // Get recipient's public key
      const recipientPublicKey =
        await keyManagementService.getUserPublicKey(recipientId);

      if (!recipientPublicKey) {
        throw new ValidationError(
          "This person needs to sign in before you can message them. Messages cannot be delivered until they've logged in at least once to set up encryption.",
          'conversation_id'
        );
      }

      // Import recipient's public key
      const recipientPublicKeyCrypto = await crypto.subtle.importKey(
        'jwk',
        recipientPublicKey,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        []
      );

      // Derive shared secret using sender's derived private key
      const sharedSecret = await encryptionService.deriveSharedSecret(
        senderKeys.privateKey,
        recipientPublicKeyCrypto
      );

      // Encrypt message content
      const encrypted = await encryptionService.encryptMessage(
        content,
        sharedSecret
      );

      // Check if online - if offline, queue immediately
      if (!navigator.onLine) {
        const messageId = crypto.randomUUID();
        await offlineQueueService.queueMessage({
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
        });

        // Return a placeholder message object
        const queuedMessage: Message = {
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          sequence_number: 0, // Will be assigned when synced
          deleted: false,
          edited: false,
          edited_at: null,
          delivered_at: null,
          read_at: null,
          created_at: new Date().toISOString(),
        };

        return {
          message: queuedMessage,
          queued: true, // Message queued for later sync
        };
      }

      // Online - attempt to send to database
      try {
        // Get next sequence number for this conversation
        const { data: lastMessage } = await (supabase as any)
          .from('messages')
          .select('sequence_number')
          .eq('conversation_id', input.conversation_id)
          .order('sequence_number', { ascending: false })
          .limit(1)
          .single();

        const nextSequenceNumber = lastMessage
          ? lastMessage.sequence_number + 1
          : 1;

        // Insert encrypted message
        const { data: message, error: insertError } = await (supabase as any)
          .from('messages')
          .insert({
            conversation_id: input.conversation_id,
            sender_id: user.id,
            encrypted_content: encrypted.ciphertext,
            initialization_vector: encrypted.iv,
            sequence_number: nextSequenceNumber,
            deleted: false,
            edited: false,
            delivered_at: new Date().toISOString(), // Mark as delivered immediately (saved to database)
          })
          .select()
          .single();

        if (insertError) {
          // Send failed - queue for retry
          throw new ConnectionError(
            'Failed to send message: ' + insertError.message
          );
        }

        // Update conversation's last_message_at
        await (supabase as any)
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', input.conversation_id);

        return {
          message,
          queued: false, // Not queued (successful send)
        };
      } catch (sendError) {
        // Online but send failed - queue with retry
        const messageId = crypto.randomUUID();
        await offlineQueueService.queueMessage({
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
        });

        // Return a placeholder message object
        const queuedMessage: Message = {
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          sequence_number: 0, // Will be assigned when synced
          deleted: false,
          edited: false,
          edited_at: null,
          delivered_at: null,
          read_at: null,
          created_at: new Date().toISOString(),
        };

        return {
          message: queuedMessage,
          queued: true, // Message queued for retry
        };
      }
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof EncryptionError ||
        error instanceof EncryptionLockedError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to send message', error);
    }
  }

  /**
   * Get message history for a conversation with pagination
   * Task: T062, T167 (updated with caching and offline support)
   *
   * Retrieves encrypted messages from the database and decrypts them for display.
   * Messages that fail to decrypt are shown with a placeholder text.
   *
   * Offline support:
   * - If online: fetch from database and cache results
   * - If offline: fallback to cached messages from IndexedDB
   *
   * @param conversationId - UUID of the conversation to fetch messages from
   * @param cursor - Sequence number to start from for pagination (null fetches latest messages)
   * @param limit - Maximum number of messages to fetch (default: 50, max: 50)
   * @returns Promise<MessageHistory> - Decrypted messages in chronological order with pagination info
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if conversation not found
   * @throws EncryptionError if encryption keys cannot be initialized
   * @throws ConnectionError if database query fails
   *
   * @example
   * ```typescript
   * // Fetch latest 50 messages
   * const result = await messageService.getMessageHistory(conversationId);
   *
   * // Fetch next page
   * const nextPage = await messageService.getMessageHistory(
   *   conversationId,
   *   result.cursor,
   *   50
   * );
   * ```
   */
  async getMessageHistory(
    conversationId: string,
    cursor: number | null = null,
    limit: number = 50
  ): Promise<MessageHistory> {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError('You must be signed in to view messages');
    }

    try {
      // Variables to hold messages across different code paths
      let messages: any = [];
      let hasMore: boolean = false;
      let messagesToDecrypt: any[] = [];

      // If offline, try to load from cache
      if (!navigator.onLine) {
        const cachedMessages = await cacheService.getCachedMessages(
          conversationId,
          limit
        );

        // If we have cached messages, return them (already in Message format)
        // Note: Cached messages are encrypted, so we still need to decrypt them
        // Fall through to normal decryption logic below with cached messages
        if (cachedMessages.length > 0) {
          // Use cached messages variable in place of database query result
          messages = cachedMessages;
          hasMore = false; // Can't determine has_more from cache
          messagesToDecrypt = messages;

          // Skip to decryption section (conversation and key fetching below)
        } else {
          // No cached messages and offline - return empty
          return {
            messages: [],
            has_more: false,
            cursor: null,
          };
        }
      }

      // Online - fetch from database
      if (navigator.onLine) {
        // Build query
        let query = (supabase as any)
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('deleted', false)
          .order('sequence_number', { ascending: false })
          .limit(limit + 1); // Fetch one extra to check has_more

        // Add cursor if provided (pagination)
        if (cursor !== null) {
          query = query.lt('sequence_number', cursor);
        }

        const { data: fetchedMessages, error } = await query;

        if (error) {
          // Failed to fetch - try cache fallback
          const cachedMessages = await cacheService.getCachedMessages(
            conversationId,
            limit
          );

          if (cachedMessages.length > 0) {
            messages = cachedMessages;
            hasMore = false;
            messagesToDecrypt = messages;
          } else {
            throw new ConnectionError(
              'Failed to fetch messages: ' + error.message
            );
          }
        } else {
          // Successfully fetched from database
          messages = fetchedMessages;
          hasMore = messages && messages.length > limit;
          messagesToDecrypt = hasMore
            ? messages.slice(0, limit)
            : messages || [];

          // Cache the fetched messages for offline use
          if (messages && messages.length > 0) {
            await cacheService.cacheMessages(conversationId, messagesToDecrypt);
          }
        }
      }

      // Variables messages, hasMore, messagesToDecrypt are set above in either path

      // Get conversation details for decryption
      const { data: conversation } = await (supabase as any)
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) {
        throw new ValidationError('Conversation not found', 'conversationId');
      }

      // Determine other participant
      const otherParticipantId =
        conversation.participant_1_id === user.id
          ? conversation.participant_2_id
          : conversation.participant_1_id;

      // Get both users' profiles for display names
      const { data: profiles } = await (supabase as any)
        .from('user_profiles')
        .select('id, username, display_name')
        .in('id', [user.id, otherParticipantId]);

      const profileMap = new Map<string, UserProfile>();
      profiles?.forEach((profile: any) => {
        profileMap.set(profile.id, profile);
      });

      // If no messages, just return empty array (no need for keys)
      if (messagesToDecrypt.length === 0) {
        return {
          messages: [],
          has_more: false,
          cursor: null,
        };
      }

      // Get private key for decryption from memory (derived on login)
      console.log('[Decryption] Starting for conversation:', conversationId);
      const currentKeys = keyManagementService.getCurrentKeys();

      if (!currentKeys) {
        console.error(
          '[Decryption] CRITICAL: Encryption keys not available - user needs to re-authenticate'
        );
        throw new EncryptionLockedError(
          'Your encryption keys are not available. Please sign in again to view messages.'
        );
      }

      console.log('[Decryption] Keys available in memory for user:', user.id);

      // Get other participant's public key
      console.log(
        '[Decryption] Fetching public key for other user:',
        otherParticipantId
      );
      const otherPublicKey =
        await keyManagementService.getUserPublicKey(otherParticipantId);
      console.log(
        '[Decryption] Other user public key:',
        otherPublicKey ? 'FOUND' : 'MISSING'
      );

      if (!otherPublicKey) {
        // Cannot decrypt messages without other user's public key
        // This shouldn't happen if messages exist, but handle gracefully
        console.error(
          '[Decryption] CRITICAL: Cannot decrypt - other user has no public key'
        );
        return {
          messages: [],
          has_more: false,
          cursor: null,
        };
      }

      console.log(
        '[Decryption] Importing other user public key via crypto.subtle...'
      );
      const otherPublicKeyCrypto = await crypto.subtle.importKey(
        'jwk',
        otherPublicKey,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        []
      );
      console.log('[Decryption] Other user public key imported successfully');

      // Derive shared secret using our derived private key
      console.log('[Decryption] Deriving ECDH shared secret...');
      console.log(
        '[Decryption] Key setup: currentUser =',
        user.id,
        '| otherParticipant =',
        otherParticipantId
      );
      const sharedSecret = await encryptionService.deriveSharedSecret(
        currentKeys.privateKey,
        otherPublicKeyCrypto
      );
      console.log('[Decryption] Shared secret derived successfully');

      // Decrypt all messages
      console.log(
        '[Decryption] Decrypting',
        messagesToDecrypt.length,
        'messages...'
      );
      console.log(
        '[Decryption] Note: Messages from',
        user.id,
        '= sent by me, from',
        otherParticipantId,
        '= received'
      );
      const decryptedMessages: DecryptedMessage[] = await Promise.all(
        messagesToDecrypt.map(async (msg: any) => {
          try {
            const content = await encryptionService.decryptMessage(
              msg.encrypted_content,
              msg.initialization_vector,
              sharedSecret
            );

            const senderProfile = profileMap.get(msg.sender_id);

            return {
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              content,
              sequence_number: msg.sequence_number,
              deleted: msg.deleted,
              edited: msg.edited,
              edited_at: msg.edited_at,
              delivered_at: msg.delivered_at,
              read_at: msg.read_at,
              created_at: msg.created_at,
              isOwn: msg.sender_id === user.id,
              senderName:
                senderProfile?.display_name ||
                senderProfile?.username ||
                'Unknown',
            };
          } catch (decryptError) {
            // Log the decryption failure with details (but not sensitive data)
            const err = decryptError as Error;
            // Log as individual args to avoid DOMException serialization issues
            console.error(
              '[Decryption] FAILED for message:',
              msg.id,
              '| error:',
              String(err.name || 'unknown'),
              '-',
              String(err.message || 'no message'),
              '| sender:',
              msg.sender_id,
              '| content length:',
              msg.encrypted_content?.length || 0,
              '| IV length:',
              msg.initialization_vector?.length || 0,
              '| created:',
              msg.created_at
            );
            return {
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              content: '[Message could not be decrypted]',
              sequence_number: msg.sequence_number,
              deleted: msg.deleted,
              edited: msg.edited,
              edited_at: msg.edited_at,
              delivered_at: msg.delivered_at,
              read_at: msg.read_at,
              created_at: msg.created_at,
              isOwn: msg.sender_id === user.id,
              senderName: 'Unknown',
            };
          }
        })
      );
      console.log(
        '[Decryption] Completed decryption for',
        decryptedMessages.length,
        'messages'
      );

      // Reverse to chronological order (oldest first)
      decryptedMessages.reverse();

      return {
        messages: decryptedMessages,
        has_more: hasMore,
        cursor:
          decryptedMessages.length > 0
            ? decryptedMessages[0].sequence_number
            : null,
      };
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof EncryptionError ||
        error instanceof EncryptionLockedError ||
        error instanceof ConnectionError ||
        error instanceof ValidationError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to get message history', error);
    }
  }

  /**
   * Mark messages as read by updating their read_at timestamp
   * Task: T063
   *
   * Updates the read_at field for messages that haven't been read yet.
   * Only affects messages where read_at is currently null.
   * This operation is silent - errors won't be thrown to avoid disrupting message viewing.
   *
   * @param messageIds - Array of message UUIDs to mark as read
   * @returns Promise<void> - Completes silently, even if some messages fail to update
   * @throws AuthenticationError if user is not signed in
   * @throws ConnectionError if database update completely fails
   *
   * @example
   * ```typescript
   * // Mark unread messages as read when user views conversation
   * const unreadMessages = messages.filter(m => !m.isOwn && !m.read_at);
   * const messageIds = unreadMessages.map(m => m.id);
   * await messageService.markAsRead(messageIds);
   * ```
   */
  async markAsRead(messageIds: string[]): Promise<void> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to mark messages as read'
      );
    }

    if (messageIds.length === 0) {
      return;
    }

    console.log(
      '[MessageService] markAsRead called with',
      messageIds.length,
      'messages'
    );
    try {
      const { error, count } = await (supabase as any)
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', messageIds)
        .is('read_at', null); // Only update if not already read

      if (error) {
        console.error('[MessageService] markAsRead error:', error);
        throw new ConnectionError(
          'Failed to mark messages as read: ' + error.message
        );
      }
      console.log(
        '[MessageService] markAsRead success, updated',
        count,
        'messages'
      );
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to mark messages as read', error);
    }
  }

  /**
   * Edit a message within the 15-minute window
   * Task: T105
   *
   * Re-encrypts the message content with new plaintext and updates the database.
   * Only allows editing if:
   * - User is the message sender
   * - Message is within 15-minute edit window
   * - Message is not deleted
   *
   * @param input - EditMessageInput with message_id and new_content
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if message not found, not owned, or outside edit window
   * @throws EncryptionError if re-encryption fails
   * @throws ConnectionError if database update fails
   *
   * @example
   * ```typescript
   * await messageService.editMessage({
   *   message_id: '123e4567-e89b-12d3-a456-426614174000',
   *   new_content: 'Updated message text'
   * });
   * ```
   */
  async editMessage(input: {
    message_id: string;
    new_content: string;
  }): Promise<void> {
    const supabase = createClient();

    // Validate new content
    const content = input.new_content.trim();

    if (content.length < MESSAGE_CONSTRAINTS.MIN_LENGTH) {
      throw new ValidationError('Message cannot be empty', 'new_content');
    }

    if (content.length > MESSAGE_CONSTRAINTS.MAX_LENGTH) {
      throw new ValidationError(
        `Message cannot exceed ${MESSAGE_CONSTRAINTS.MAX_LENGTH} characters`,
        'new_content'
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError('You must be signed in to edit messages');
    }

    try {
      // Get the message to edit
      const { data: message, error: fetchError } = await (supabase as any)
        .from('messages')
        .select('*')
        .eq('id', input.message_id)
        .single();

      if (fetchError || !message) {
        throw new ValidationError('Message not found', 'message_id');
      }

      // Verify ownership
      if (message.sender_id !== user.id) {
        throw new ValidationError(
          'You can only edit your own messages',
          'message_id'
        );
      }

      // Check if already deleted
      if (message.deleted) {
        throw new ValidationError(
          'Cannot edit a deleted message',
          'message_id'
        );
      }

      // Check 15-minute window
      const createdAt = new Date(message.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

      if (diffMinutes > MESSAGE_CONSTRAINTS.EDIT_WINDOW_MINUTES) {
        throw new ValidationError(
          `Messages can only be edited within ${MESSAGE_CONSTRAINTS.EDIT_WINDOW_MINUTES} minutes`,
          'message_id'
        );
      }

      // Get conversation details for encryption
      const { data: conversation, error: convError } = await (supabase as any)
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', message.conversation_id)
        .single();

      if (convError || !conversation) {
        throw new ValidationError('Conversation not found', 'conversation_id');
      }

      // Determine recipient ID
      const recipientId =
        conversation.participant_1_id === user.id
          ? conversation.participant_2_id
          : conversation.participant_1_id;

      // Get sender's derived keys from memory
      const senderKeys = keyManagementService.getCurrentKeys();
      if (!senderKeys) {
        throw new EncryptionLockedError(
          'Your encryption keys are not available. Please sign in again to edit messages.'
        );
      }

      // Get recipient's public key
      const recipientPublicKey =
        await keyManagementService.getUserPublicKey(recipientId);

      if (!recipientPublicKey) {
        throw new EncryptionError(
          'Cannot edit message: recipient encryption keys not available'
        );
      }

      // Import recipient's public key
      const recipientPublicKeyCrypto = await crypto.subtle.importKey(
        'jwk',
        recipientPublicKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );

      // Derive shared secret using sender's derived private key
      const sharedSecret = await encryptionService.deriveSharedSecret(
        senderKeys.privateKey,
        recipientPublicKeyCrypto
      );

      // Encrypt new content
      const encrypted = await encryptionService.encryptMessage(
        content,
        sharedSecret
      );

      // Update message in database
      const { error: updateError } = await (supabase as any)
        .from('messages')
        .update({
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', input.message_id);

      if (updateError) {
        throw new ConnectionError(
          'Failed to update message: ' + updateError.message
        );
      }
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof EncryptionError ||
        error instanceof EncryptionLockedError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to edit message', error);
    }
  }

  /**
   * Delete a message within the 15-minute window (soft delete)
   * Task: T106
   *
   * Marks a message as deleted without removing it from the database.
   * Only allows deletion if:
   * - User is the message sender
   * - Message is within 15-minute delete window
   * - Message is not already deleted
   *
   * @param message_id - UUID of the message to delete
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if message not found, not owned, or outside delete window
   * @throws ConnectionError if database update fails
   *
   * @example
   * ```typescript
   * await messageService.deleteMessage('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async deleteMessage(message_id: string): Promise<void> {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError('You must be signed in to delete messages');
    }

    try {
      // Get the message to delete
      const { data: message, error: fetchError } = await (supabase as any)
        .from('messages')
        .select('*')
        .eq('id', message_id)
        .single();

      if (fetchError || !message) {
        throw new ValidationError('Message not found', 'message_id');
      }

      // Verify ownership
      if (message.sender_id !== user.id) {
        throw new ValidationError(
          'You can only delete your own messages',
          'message_id'
        );
      }

      // Check if already deleted
      if (message.deleted) {
        throw new ValidationError('Message is already deleted', 'message_id');
      }

      // Check 15-minute window
      const createdAt = new Date(message.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

      if (diffMinutes > MESSAGE_CONSTRAINTS.DELETE_WINDOW_MINUTES) {
        throw new ValidationError(
          `Messages can only be deleted within ${MESSAGE_CONSTRAINTS.DELETE_WINDOW_MINUTES} minutes`,
          'message_id'
        );
      }

      // Soft delete - set deleted flag
      const { error: updateError } = await (supabase as any)
        .from('messages')
        .update({
          deleted: true,
        })
        .eq('id', message_id);

      if (updateError) {
        throw new ConnectionError(
          'Failed to delete message: ' + updateError.message
        );
      }
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to delete message', error);
    }
  }

  /**
   * Archive a conversation for the current user
   * Per-user archive: User A archiving doesn't affect User B's view
   *
   * @param conversationId - UUID of the conversation to archive
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if conversation not found or user not a participant
   * @throws ConnectionError if database update fails
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to archive conversations'
      );
    }

    try {
      // Get conversation to determine which participant the user is
      const { data: conversation, error: fetchError } = await (supabase as any)
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', conversationId)
        .single();

      if (fetchError || !conversation) {
        throw new ValidationError('Conversation not found', 'conversationId');
      }

      // Determine which column to update based on user's participant role
      let updateColumn: string;
      if (conversation.participant_1_id === user.id) {
        updateColumn = 'archived_by_participant_1';
      } else if (conversation.participant_2_id === user.id) {
        updateColumn = 'archived_by_participant_2';
      } else {
        throw new ValidationError(
          'You are not a participant in this conversation',
          'conversationId'
        );
      }

      console.log(
        '[MessageService] archiveConversation:',
        conversationId,
        'column:',
        updateColumn
      );

      // Update the archive status
      const { error: updateError, data: updateData } = await (supabase as any)
        .from('conversations')
        .update({ [updateColumn]: true })
        .eq('id', conversationId)
        .select();

      if (updateError) {
        console.error(
          '[MessageService] archiveConversation error:',
          updateError
        );
        throw new ConnectionError(
          'Failed to archive conversation: ' + updateError.message
        );
      }

      console.log('[MessageService] archiveConversation success:', updateData);
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to archive conversation', error);
    }
  }

  /**
   * Unarchive a conversation for the current user
   *
   * @param conversationId - UUID of the conversation to unarchive
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if conversation not found or user not a participant
   * @throws ConnectionError if database update fails
   */
  async unarchiveConversation(conversationId: string): Promise<void> {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to unarchive conversations'
      );
    }

    try {
      // Get conversation to determine which participant the user is
      const { data: conversation, error: fetchError } = await (supabase as any)
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', conversationId)
        .single();

      if (fetchError || !conversation) {
        throw new ValidationError('Conversation not found', 'conversationId');
      }

      // Determine which column to update based on user's participant role
      let updateColumn: string;
      if (conversation.participant_1_id === user.id) {
        updateColumn = 'archived_by_participant_1';
      } else if (conversation.participant_2_id === user.id) {
        updateColumn = 'archived_by_participant_2';
      } else {
        throw new ValidationError(
          'You are not a participant in this conversation',
          'conversationId'
        );
      }

      // Update the archive status
      const { error: updateError } = await (supabase as any)
        .from('conversations')
        .update({ [updateColumn]: false })
        .eq('id', conversationId);

      if (updateError) {
        throw new ConnectionError(
          'Failed to unarchive conversation: ' + updateError.message
        );
      }
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to unarchive conversation', error);
    }
  }
}

// Export singleton instance
export const messageService = new MessageService();
