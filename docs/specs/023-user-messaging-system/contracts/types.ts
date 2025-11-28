/**
 * TypeScript Type Contracts for User Messaging System
 * Generated: 2025-10-08
 * For: PRP-023
 *
 * These types define the public API contracts for the messaging system.
 * They are independent of database schemas and internal implementation.
 */

// =============================================================================
// DATABASE ENTITIES (Mirror PostgreSQL schema)
// =============================================================================

export type ConnectionStatus = 'pending' | 'accepted' | 'blocked' | 'declined';

export interface UserConnection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string; // Base64-encoded ciphertext
  initialization_vector: string; // Base64-encoded IV
  sequence_number: number;
  deleted: boolean;
  edited: boolean;
  edited_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface UserEncryptionKey {
  id: string;
  user_id: string;
  public_key: JsonWebKey; // JWK format
  device_id: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface ConversationKey {
  id: string;
  conversation_id: string;
  user_id: string;
  encrypted_shared_secret: string;
  key_version: number;
  created_at: string;
}

export interface TypingIndicator {
  id: string;
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
}

// =============================================================================
// INDEXEDDB ENTITIES (Client-side storage)
// =============================================================================

export interface QueuedMessage {
  id: string; // UUID
  conversation_id: string;
  encrypted_content: string;
  initialization_vector: string;
  synced: boolean;
  retries: number;
  created_at: number; // Unix timestamp
}

// CachedMessage is identical to Message but stored in IndexedDB
export type CachedMessage = Message;

export interface PrivateKey {
  userId: string;
  privateKey: JsonWebKey;
  created_at: number;
}

// =============================================================================
// APPLICATION TYPES (UI/Business Logic)
// =============================================================================

export interface DecryptedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string; // Decrypted plaintext
  sequence_number: number;
  deleted: boolean;
  edited: boolean;
  edited_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  isOwn: boolean; // Convenience flag
  senderName: string; // From user profile
}

export interface ConversationWithParticipants extends Conversation {
  participants: {
    participant_1: UserProfile;
    participant_2: UserProfile;
  };
  unread_count: number;
  last_message_preview: string | null;
}

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ConnectionRequest {
  connection: UserConnection;
  requester: UserProfile;
  addressee: UserProfile;
}

// =============================================================================
// SERVICE LAYER INPUTS
// =============================================================================

export interface SendMessageInput {
  conversation_id: string;
  content: string; // Plaintext (will be encrypted)
}

export interface EditMessageInput {
  message_id: string;
  new_content: string; // Plaintext (will be re-encrypted)
}

export interface DeleteMessageInput {
  message_id: string;
}

export interface SendFriendRequestInput {
  addressee_email: string; // Search by email
}

export interface RespondToRequestInput {
  connection_id: string;
  action: 'accept' | 'decline' | 'block';
}

export interface SearchUsersInput {
  query: string; // Email or username (exact match)
  limit?: number;
}

// =============================================================================
// SERVICE LAYER OUTPUTS
// =============================================================================

export interface SendMessageResult {
  message: Message; // Encrypted version stored in DB
  queued: boolean; // True if offline and queued
}

export interface MessageHistory {
  messages: DecryptedMessage[];
  has_more: boolean;
  cursor: number | null; // sequence_number for pagination
}

export interface ConnectionList {
  pending_sent: ConnectionRequest[];
  pending_received: ConnectionRequest[];
  accepted: ConnectionRequest[];
  blocked: ConnectionRequest[];
}

export interface SearchUsersResult {
  users: UserProfile[];
  already_connected: string[]; // user_ids already connected
}

// =============================================================================
// CRYPTO TYPES
// =============================================================================

export interface EncryptedPayload {
  ciphertext: string; // Base64-encoded
  iv: string; // Base64-encoded initialization vector
}

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface SharedSecret {
  key: CryptoKey; // AES-GCM key derived from ECDH
  derived_at: number; // Unix timestamp
}

// =============================================================================
// REALTIME EVENT TYPES
// =============================================================================

export interface RealtimeNewMessagePayload {
  new: Message;
}

export interface RealtimeMessageUpdatePayload {
  new: Message;
  old: Message;
}

export interface RealtimeTypingPayload {
  new: TypingIndicator;
  old: TypingIndicator | null;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface MessageValidationRules {
  max_length: number; // 10,000 characters
  min_length: number; // 1 character
  allow_empty_after_trim: boolean; // false
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

export interface UseConversationRealtimeReturn {
  messages: DecryptedMessage[];
  loading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  editMessage: (message_id: string, new_content: string) => Promise<void>;
  deleteMessage: (message_id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export interface UseTypingIndicatorReturn {
  isTyping: boolean; // Other user typing
  setTyping: (typing: boolean) => void; // Set own typing status
}

export interface UseOfflineQueueReturn {
  queue: QueuedMessage[];
  queueCount: number;
  syncQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export interface UseConnectionsReturn {
  connections: ConnectionList;
  loading: boolean;
  error: Error | null;
  sendRequest: (email: string) => Promise<void>;
  acceptRequest: (connection_id: string) => Promise<void>;
  declineRequest: (connection_id: string) => Promise<void>;
  blockUser: (connection_id: string) => Promise<void>;
  searchUsers: (query: string) => Promise<SearchUsersResult>;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class EncryptionError extends Error {
  constructor(
    message: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(
    message: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class ConnectionError extends Error {
  constructor(
    message: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const MESSAGE_CONSTRAINTS = {
  MAX_LENGTH: 10000,
  MIN_LENGTH: 1,
  EDIT_WINDOW_MINUTES: 15,
  DELETE_WINDOW_MINUTES: 15,
} as const;

export const CRYPTO_PARAMS = {
  ALGORITHM: 'ECDH',
  CURVE: 'P-256',
  AES_ALGORITHM: 'AES-GCM',
  AES_KEY_LENGTH: 256,
  IV_LENGTH_BYTES: 12, // 96 bits
} as const;

export const OFFLINE_QUEUE_CONFIG = {
  MAX_RETRIES: 5,
  BACKOFF_MULTIPLIER: 2, // Exponential: 1s, 2s, 4s, 8s, 16s
  INITIAL_DELAY_MS: 1000,
} as const;

export const REALTIME_CONFIG = {
  TYPING_DEBOUNCE_MS: 3000,
  TYPING_EXPIRE_SECONDS: 5,
  MESSAGE_DELIVERY_TIMEOUT_MS: 500,
} as const;

export const CACHE_CONFIG = {
  MAX_MESSAGES_PER_CONVERSATION: 1000,
  MESSAGE_RETENTION_DAYS: 30,
  PAGINATION_PAGE_SIZE: 50,
} as const;
