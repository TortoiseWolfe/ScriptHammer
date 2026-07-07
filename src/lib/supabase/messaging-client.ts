/**
 * Typed Messaging Client
 *
 * Provides a properly typed Supabase client for messaging operations.
 * The messaging tables are now included in the base Database type.
 *
 * @example
 * ```typescript
 * import { getMessagingClient } from '@/lib/supabase/messaging-client';
 *
 * const client = getMessagingClient(supabase);
 * const { data } = await client.from('conversations').select('*');
 * // data is properly typed as ConversationRow[]
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from './types';

// ============================================================================
// Typed Client
// ============================================================================

/**
 * Supabase client typed for messaging operations
 */
export type MessagingClient = SupabaseClient<Database>;

/**
 * Get a typed Supabase client for messaging operations
 *
 * Since messaging tables are now in the Database type, this simply
 * returns the client with proper typing.
 *
 * @param client - Base Supabase client
 * @returns The same client (types are already correct)
 */
export function createMessagingClient(
  client: SupabaseClient<Database>
): MessagingClient {
  return client;
}

// Alias for backward compatibility
export const getMessagingClient = createMessagingClient;

// ============================================================================
// Row Type Exports (convenience re-exports from Database)
// ============================================================================

/** User connection/friend request record */
export type UserConnectionRow = Tables<'user_connections'>;

/** 1-to-1 conversation record */
export type ConversationRow = Tables<'conversations'>;

/** Encrypted message record */
export type MessageRow = Tables<'messages'>;

/** User encryption key record */
export type UserEncryptionKeyRow = Tables<'user_encryption_keys'>;

/** Conversation key record */
export type ConversationKeyRow = Tables<'conversation_keys'>;

/** Typing indicator record */
export type TypingIndicatorRow = Tables<'typing_indicators'>;

// ============================================================================
// Insert/Update Types (for write operations)
// ============================================================================

import type { TablesInsert, TablesUpdate } from './types';

export type UserConnectionInsert = TablesInsert<'user_connections'>;
export type UserConnectionUpdate = TablesUpdate<'user_connections'>;
export type ConversationInsert = TablesInsert<'conversations'>;
export type ConversationUpdate = TablesUpdate<'conversations'>;
export type MessageInsert = TablesInsert<'messages'>;
export type MessageUpdate = TablesUpdate<'messages'>;
export type UserEncryptionKeyInsert = TablesInsert<'user_encryption_keys'>;
export type UserEncryptionKeyUpdate = TablesUpdate<'user_encryption_keys'>;
export type TypingIndicatorInsert = TablesInsert<'typing_indicators'>;
export type TypingIndicatorUpdate = TablesUpdate<'typing_indicators'>;

// ============================================================================
// Connection Status Type
// ============================================================================

/** Connection status between users */
export type ConnectionStatus = 'pending' | 'accepted' | 'blocked' | 'declined';

// ============================================================================
// Query Builder Types (for complex queries)
// ============================================================================

/**
 * Type helper for conversation queries with joined data
 */
export interface ConversationWithParticipants extends ConversationRow {
  participant_1?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  participant_2?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Type helper for message queries with sender data
 */
export interface MessageWithSender extends MessageRow {
  sender?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Type helper for connection queries with user profiles
 */
export interface ConnectionWithProfiles extends UserConnectionRow {
  requester?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  addressee?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}
