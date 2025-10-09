/**
 * API Service Contracts for User Messaging System
 * Generated: 2025-10-08
 * For: PRP-023
 *
 * These interfaces define the public API contracts for all messaging services.
 * Implementation files MUST implement these interfaces exactly.
 */

import type {
  Message,
  DecryptedMessage,
  SendMessageInput,
  EditMessageInput,
  DeleteMessageInput,
  SendMessageResult,
  MessageHistory,
  UserConnection,
  SendFriendRequestInput,
  RespondToRequestInput,
  ConnectionList,
  SearchUsersInput,
  SearchUsersResult,
  UserEncryptionKey,
  KeyPair,
  SharedSecret,
  EncryptedPayload,
  QueuedMessage,
} from './types';

// =============================================================================
// MESSAGE SERVICE
// =============================================================================

export interface IMessageService {
  /**
   * Send a new message to a conversation
   * @throws AuthenticationError if not authenticated
   * @throws ConnectionError if not connected to recipient
   * @throws EncryptionError if encryption fails
   * @throws ValidationError if content invalid
   */
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;

  /**
   * Edit an existing message (within 15-minute window)
   * @throws AuthenticationError if not authenticated
   * @throws EncryptionError if re-encryption fails
   * @throws ValidationError if message too old or not owned by user
   */
  editMessage(input: EditMessageInput): Promise<Message>;

  /**
   * Delete a message (soft-delete, within 15-minute window)
   * @throws AuthenticationError if not authenticated
   * @throws ValidationError if message too old or not owned by user
   */
  deleteMessage(input: DeleteMessageInput): Promise<void>;

  /**
   * Get message history for a conversation (decrypted)
   * @param conversation_id - Conversation ID
   * @param cursor - sequence_number to start from (for pagination)
   * @param limit - Number of messages to fetch (default: 50)
   * @throws AuthenticationError if not authenticated
   * @throws DecryptionError if messages cannot be decrypted
   */
  getMessageHistory(
    conversation_id: string,
    cursor?: number,
    limit?: number
  ): Promise<MessageHistory>;

  /**
   * Mark messages as read
   * @param message_ids - Array of message IDs to mark as read
   * @throws AuthenticationError if not authenticated
   */
  markAsRead(message_ids: string[]): Promise<void>;
}

// =============================================================================
// CONNECTION SERVICE
// =============================================================================

export interface IConnectionService {
  /**
   * Send a friend request to another user
   * @throws AuthenticationError if not authenticated
   * @throws ValidationError if user not found or already connected
   */
  sendFriendRequest(input: SendFriendRequestInput): Promise<UserConnection>;

  /**
   * Respond to a friend request (accept/decline/block)
   * @throws AuthenticationError if not authenticated
   * @throws ValidationError if request not found or not addressee
   */
  respondToRequest(input: RespondToRequestInput): Promise<UserConnection>;

  /**
   * Get all connections for authenticated user
   * @throws AuthenticationError if not authenticated
   */
  getConnections(): Promise<ConnectionList>;

  /**
   * Search for users by email or username (exact match)
   * @throws AuthenticationError if not authenticated
   */
  searchUsers(input: SearchUsersInput): Promise<SearchUsersResult>;

  /**
   * Remove a connection (unfriend)
   * @throws AuthenticationError if not authenticated
   * @throws ValidationError if connection not found
   */
  removeConnection(connection_id: string): Promise<void>;
}

// =============================================================================
// ENCRYPTION SERVICE
// =============================================================================

export interface IEncryptionService {
  /**
   * Generate ECDH key pair for user (lazy initialization)
   * @throws EncryptionError if key generation fails
   */
  generateKeyPair(): Promise<KeyPair>;

  /**
   * Export public key to JWK format for database storage
   * @throws EncryptionError if export fails
   */
  exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey>;

  /**
   * Store private key in IndexedDB (never transmitted)
   * @param userId - User ID
   * @param privateKey - Private key to store
   * @throws EncryptionError if storage fails
   */
  storePrivateKey(userId: string, privateKey: CryptoKey): Promise<void>;

  /**
   * Retrieve private key from IndexedDB
   * @param userId - User ID
   * @returns Private key or null if not found
   */
  getPrivateKey(userId: string): Promise<CryptoKey | null>;

  /**
   * Derive shared secret from private key and recipient's public key (ECDH)
   * @throws EncryptionError if derivation fails
   */
  deriveSharedSecret(
    privateKey: CryptoKey,
    recipientPublicKey: JsonWebKey
  ): Promise<SharedSecret>;

  /**
   * Encrypt message content using shared secret (AES-GCM)
   * @throws EncryptionError if encryption fails
   */
  encryptMessage(
    content: string,
    sharedSecret: CryptoKey
  ): Promise<EncryptedPayload>;

  /**
   * Decrypt message content using shared secret (AES-GCM)
   * @throws DecryptionError if decryption fails
   */
  decryptMessage(
    encrypted: EncryptedPayload,
    sharedSecret: CryptoKey
  ): Promise<string>;

  /**
   * Get user's public key from database
   * @param userId - User ID
   * @returns Public key or null if user hasn't generated keys yet
   */
  getUserPublicKey(userId: string): Promise<UserEncryptionKey | null>;
}

// =============================================================================
// OFFLINE QUEUE SERVICE
// =============================================================================

export interface IOfflineQueueService {
  /**
   * Add message to offline queue (when connection unavailable)
   * @param message - Message to queue
   */
  queueMessage(message: QueuedMessage): Promise<void>;

  /**
   * Get all queued messages
   */
  getQueue(): Promise<QueuedMessage[]>;

  /**
   * Sync queued messages to server (retry with exponential backoff)
   * @returns Number of successfully synced messages
   */
  syncQueue(): Promise<number>;

  /**
   * Remove successfully synced message from queue
   */
  removeFromQueue(id: string): Promise<void>;

  /**
   * Clear entire queue (use with caution)
   */
  clearQueue(): Promise<void>;

  /**
   * Get retry delay for failed message (exponential backoff)
   * @param retries - Number of previous retry attempts
   * @returns Delay in milliseconds
   */
  getRetryDelay(retries: number): number;
}

// =============================================================================
// REALTIME SERVICE
// =============================================================================

export interface IRealtimeService {
  /**
   * Subscribe to new messages in a conversation
   * @param conversation_id - Conversation ID
   * @param callback - Function to call when new message arrives
   * @returns Unsubscribe function
   */
  subscribeToMessages(
    conversation_id: string,
    callback: (message: Message) => void
  ): () => void;

  /**
   * Subscribe to message updates (edits/deletes) in a conversation
   * @param conversation_id - Conversation ID
   * @param callback - Function to call when message is updated
   * @returns Unsubscribe function
   */
  subscribeToMessageUpdates(
    conversation_id: string,
    callback: (message: Message, oldMessage: Message) => void
  ): () => void;

  /**
   * Subscribe to typing indicators in a conversation
   * @param conversation_id - Conversation ID
   * @param callback - Function to call when typing status changes
   * @returns Unsubscribe function
   */
  subscribeToTypingIndicators(
    conversation_id: string,
    callback: (userId: string, isTyping: boolean) => void
  ): () => void;

  /**
   * Update own typing status
   * @param conversation_id - Conversation ID
   * @param isTyping - Whether currently typing
   */
  setTypingStatus(conversation_id: string, isTyping: boolean): Promise<void>;

  /**
   * Unsubscribe from all subscriptions for a conversation
   * @param conversation_id - Conversation ID
   */
  unsubscribeFromConversation(conversation_id: string): void;
}

// =============================================================================
// VALIDATION SERVICE
// =============================================================================

export interface IValidationService {
  /**
   * Validate message content (length, non-empty after trim)
   * @throws ValidationError if invalid
   */
  validateMessageContent(content: string): void;

  /**
   * Check if message is within edit window (15 minutes)
   * @param created_at - Message creation timestamp
   * @returns True if still editable
   */
  isWithinEditWindow(created_at: string): boolean;

  /**
   * Check if message is within delete window (15 minutes)
   * @param created_at - Message creation timestamp
   * @returns True if still deletable
   */
  isWithinDeleteWindow(created_at: string): boolean;

  /**
   * Validate email format
   * @throws ValidationError if invalid
   */
  validateEmail(email: string): void;

  /**
   * Sanitize user input (prevent XSS, injection)
   * @param input - Raw user input
   * @returns Sanitized string
   */
  sanitizeInput(input: string): string;
}

// =============================================================================
// CACHE SERVICE (IndexedDB)
// =============================================================================

export interface ICacheService {
  /**
   * Cache messages from server to IndexedDB
   * @param messages - Messages to cache
   */
  cacheMessages(messages: Message[]): Promise<void>;

  /**
   * Get cached messages for offline viewing
   * @param conversation_id - Conversation ID
   * @param limit - Number of messages to fetch
   * @returns Cached messages
   */
  getCachedMessages(conversation_id: string, limit: number): Promise<Message[]>;

  /**
   * Clear cached messages older than retention period (30 days)
   */
  clearOldCache(): Promise<void>;

  /**
   * Get cache size (number of messages)
   */
  getCacheSize(): Promise<number>;
}

// =============================================================================
// KEY MANAGEMENT SERVICE
// =============================================================================

export interface IKeyManagementService {
  /**
   * Initialize user's encryption keys (lazy, on first message send)
   * @param userId - User ID
   * @returns True if keys were generated, false if already existed
   */
  initializeKeys(userId: string): Promise<boolean>;

  /**
   * Rotate user's encryption keys (security event)
   * @param userId - User ID
   * @throws EncryptionError if rotation fails
   */
  rotateKeys(userId: string): Promise<void>;

  /**
   * Revoke user's encryption keys (e.g., on password change)
   * @param userId - User ID
   */
  revokeKeys(userId: string): Promise<void>;

  /**
   * Check if user has valid encryption keys
   * @param userId - User ID
   * @returns True if user has active keys
   */
  hasValidKeys(userId: string): Promise<boolean>;

  /**
   * Export user data (GDPR compliance) - decrypts all messages
   * @param userId - User ID
   * @returns JSON blob with all conversation history
   */
  exportUserData(userId: string): Promise<Blob>;
}
