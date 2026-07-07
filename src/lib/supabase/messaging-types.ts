/**
 * Messaging System Database Types
 *
 * Extends the base Database type with messaging-specific tables.
 * These types were missing from the auto-generated types.
 *
 * @see supabase/migrations/20251006_complete_monolithic_setup.sql lines 667-964
 */

import type { Json } from './types';

// ============================================================================
// Enums and Status Types
// ============================================================================

/** Connection status between users */
export type ConnectionStatus = 'pending' | 'accepted' | 'blocked' | 'declined';

// ============================================================================
// Table Row Types (what SELECT returns)
// ============================================================================

/** User connection/friend request record */
export interface UserConnectionRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

/** 1-to-1 conversation record */
export interface ConversationRow {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string | null;
  archived_by_participant_1: boolean;
  archived_by_participant_2: boolean;
  created_at: string;
}

/** Encrypted message record */
export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  initialization_vector: string;
  sequence_number: number;
  deleted: boolean;
  edited: boolean;
  edited_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

/** User encryption key record */
export interface UserEncryptionKeyRow {
  id: string;
  user_id: string;
  public_key: Json;
  encryption_salt: string | null;
  device_id: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

/** Conversation key record */
export interface ConversationKeyRow {
  id: string;
  conversation_id: string;
  user_id: string;
  encrypted_shared_secret: string;
  key_version: number;
  created_at: string;
}

/** Typing indicator record */
export interface TypingIndicatorRow {
  id: string;
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
}

// ============================================================================
// Table Insert Types (what INSERT accepts)
// ============================================================================

export interface UserConnectionInsert {
  id?: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationInsert {
  id?: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at?: string | null;
  archived_by_participant_1?: boolean;
  archived_by_participant_2?: boolean;
  created_at?: string;
}

export interface MessageInsert {
  id?: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  initialization_vector: string;
  sequence_number?: number; // Auto-assigned by trigger
  deleted?: boolean;
  edited?: boolean;
  edited_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  created_at?: string;
}

export interface UserEncryptionKeyInsert {
  id?: string;
  user_id: string;
  public_key: Json;
  encryption_salt?: string | null;
  device_id?: string | null;
  expires_at?: string | null;
  revoked?: boolean;
  created_at?: string;
}

export interface ConversationKeyInsert {
  id?: string;
  conversation_id: string;
  user_id: string;
  encrypted_shared_secret: string;
  key_version?: number;
  created_at?: string;
}

export interface TypingIndicatorInsert {
  id?: string;
  conversation_id: string;
  user_id: string;
  is_typing?: boolean;
  updated_at?: string;
}

// ============================================================================
// Table Update Types (what UPDATE accepts)
// ============================================================================

export interface UserConnectionUpdate {
  id?: string;
  requester_id?: string;
  addressee_id?: string;
  status?: ConnectionStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationUpdate {
  id?: string;
  participant_1_id?: string;
  participant_2_id?: string;
  last_message_at?: string | null;
  archived_by_participant_1?: boolean;
  archived_by_participant_2?: boolean;
  created_at?: string;
}

export interface MessageUpdate {
  id?: string;
  conversation_id?: string;
  sender_id?: string;
  encrypted_content?: string;
  initialization_vector?: string;
  sequence_number?: number;
  deleted?: boolean;
  edited?: boolean;
  edited_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  created_at?: string;
}

export interface UserEncryptionKeyUpdate {
  id?: string;
  user_id?: string;
  public_key?: Json;
  encryption_salt?: string | null;
  device_id?: string | null;
  expires_at?: string | null;
  revoked?: boolean;
  created_at?: string;
}

export interface TypingIndicatorUpdate {
  id?: string;
  conversation_id?: string;
  user_id?: string;
  is_typing?: boolean;
  updated_at?: string;
}

// ============================================================================
// Messaging Tables Schema Extension
// ============================================================================

/** Messaging tables to extend the Database type */
export interface MessagingTables {
  user_connections: {
    Row: UserConnectionRow;
    Insert: UserConnectionInsert;
    Update: UserConnectionUpdate;
    Relationships: [
      {
        foreignKeyName: 'user_connections_requester_id_fkey';
        columns: ['requester_id'];
        isOneToOne: false;
        referencedRelation: 'user_profiles';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'user_connections_addressee_id_fkey';
        columns: ['addressee_id'];
        isOneToOne: false;
        referencedRelation: 'user_profiles';
        referencedColumns: ['id'];
      },
    ];
  };
  conversations: {
    Row: ConversationRow;
    Insert: ConversationInsert;
    Update: ConversationUpdate;
    Relationships: [
      {
        foreignKeyName: 'conversations_participant_1_id_fkey';
        columns: ['participant_1_id'];
        isOneToOne: false;
        referencedRelation: 'user_profiles';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'conversations_participant_2_id_fkey';
        columns: ['participant_2_id'];
        isOneToOne: false;
        referencedRelation: 'user_profiles';
        referencedColumns: ['id'];
      },
    ];
  };
  messages: {
    Row: MessageRow;
    Insert: MessageInsert;
    Update: MessageUpdate;
    Relationships: [
      {
        foreignKeyName: 'messages_conversation_id_fkey';
        columns: ['conversation_id'];
        isOneToOne: false;
        referencedRelation: 'conversations';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'messages_sender_id_fkey';
        columns: ['sender_id'];
        isOneToOne: false;
        referencedRelation: 'user_profiles';
        referencedColumns: ['id'];
      },
    ];
  };
  user_encryption_keys: {
    Row: UserEncryptionKeyRow;
    Insert: UserEncryptionKeyInsert;
    Update: UserEncryptionKeyUpdate;
    Relationships: [
      {
        foreignKeyName: 'user_encryption_keys_user_id_fkey';
        columns: ['user_id'];
        isOneToOne: false;
        referencedRelation: 'user_profiles';
        referencedColumns: ['id'];
      },
    ];
  };
  conversation_keys: {
    Row: ConversationKeyRow;
    Insert: ConversationKeyInsert;
    Update: Record<string, never>; // Keys are immutable
    Relationships: [
      {
        foreignKeyName: 'conversation_keys_conversation_id_fkey';
        columns: ['conversation_id'];
        isOneToOne: false;
        referencedRelation: 'conversations';
        referencedColumns: ['id'];
      },
    ];
  };
  typing_indicators: {
    Row: TypingIndicatorRow;
    Insert: TypingIndicatorInsert;
    Update: TypingIndicatorUpdate;
    Relationships: [
      {
        foreignKeyName: 'typing_indicators_conversation_id_fkey';
        columns: ['conversation_id'];
        isOneToOne: false;
        referencedRelation: 'conversations';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'typing_indicators_user_id_fkey';
        columns: ['user_id'];
        isOneToOne: false;
        referencedRelation: 'user_profiles';
        referencedColumns: ['id'];
      },
    ];
  };
}
