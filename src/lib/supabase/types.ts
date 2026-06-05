export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string;
          details: Json | null;
          event_type: string;
          id: string;
          ip_address: unknown;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          details?: Json | null;
          event_type: string;
          id?: string;
          ip_address?: unknown;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: Json | null;
          event_type?: string;
          id?: string;
          ip_address?: unknown;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      auth_audit_logs: {
        Row: {
          created_at: string;
          error_message: string | null;
          event_data: Json | null;
          event_type: string;
          id: string;
          ip_address: unknown;
          success: boolean;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          event_data?: Json | null;
          event_type: string;
          id?: string;
          ip_address?: unknown;
          success?: boolean;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          event_data?: Json | null;
          event_type?: string;
          id?: string;
          ip_address?: unknown;
          success?: boolean;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      conversation_keys: {
        Row: {
          conversation_id: string;
          created_at: string;
          encrypted_shared_secret: string;
          id: string;
          key_version: number;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          encrypted_shared_secret: string;
          id?: string;
          key_version?: number;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          encrypted_shared_secret?: string;
          id?: string;
          key_version?: number;
          user_id?: string;
        };
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
      conversation_members: {
        Row: {
          archived: boolean;
          conversation_id: string;
          id: string;
          joined_at: string;
          key_status: string;
          key_version_joined: number;
          left_at: string | null;
          muted: boolean;
          role: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          conversation_id: string;
          id?: string;
          joined_at?: string;
          key_status?: string;
          key_version_joined?: number;
          left_at?: string | null;
          muted?: boolean;
          role?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          conversation_id?: string;
          id?: string;
          joined_at?: string;
          key_status?: string;
          key_version_joined?: number;
          left_at?: string | null;
          muted?: boolean;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_members_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          archived_by_participant_1: boolean;
          archived_by_participant_2: boolean;
          created_at: string;
          created_by: string | null;
          current_key_version: number;
          group_name: string | null;
          id: string;
          is_group: boolean;
          last_message_at: string | null;
          participant_1_id: string | null;
          participant_2_id: string | null;
        };
        Insert: {
          archived_by_participant_1?: boolean;
          archived_by_participant_2?: boolean;
          created_at?: string;
          created_by?: string | null;
          current_key_version?: number;
          group_name?: string | null;
          id?: string;
          is_group?: boolean;
          last_message_at?: string | null;
          participant_1_id?: string | null;
          participant_2_id?: string | null;
        };
        Update: {
          archived_by_participant_1?: boolean;
          archived_by_participant_2?: boolean;
          created_at?: string;
          created_by?: string | null;
          current_key_version?: number;
          group_name?: string | null;
          id?: string;
          is_group?: boolean;
          last_message_at?: string | null;
          participant_1_id?: string | null;
          participant_2_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
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
      edge_idempotency_keys: {
        Row: {
          created_at: string;
          function_name: string;
          id: string;
          idempotency_key: string;
          result: Json;
        };
        Insert: {
          created_at?: string;
          function_name: string;
          id?: string;
          idempotency_key: string;
          result: Json;
        };
        Update: {
          created_at?: string;
          function_name?: string;
          id?: string;
          idempotency_key?: string;
          result?: Json;
        };
        Relationships: [];
      };
      group_keys: {
        Row: {
          conversation_id: string;
          created_at: string;
          created_by: string;
          encrypted_key: string;
          id: string;
          key_version: number;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          created_by: string;
          encrypted_key: string;
          id?: string;
          key_version?: number;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          created_by?: string;
          encrypted_key?: string;
          id?: string;
          key_version?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_keys_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_keys_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_keys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          conversation_id: string;
          created_at: string;
          deleted: boolean;
          delivered_at: string | null;
          edited: boolean;
          edited_at: string | null;
          encrypted_content: string;
          id: string;
          initialization_vector: string;
          is_system_message: boolean;
          key_version: number;
          read_at: string | null;
          sender_id: string;
          sequence_number: number;
          system_message_type: string | null;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          deleted?: boolean;
          delivered_at?: string | null;
          edited?: boolean;
          edited_at?: string | null;
          encrypted_content: string;
          id?: string;
          initialization_vector: string;
          is_system_message?: boolean;
          key_version?: number;
          read_at?: string | null;
          sender_id: string;
          sequence_number: number;
          system_message_type?: string | null;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          deleted?: boolean;
          delivered_at?: string | null;
          edited?: boolean;
          edited_at?: string | null;
          encrypted_content?: string;
          id?: string;
          initialization_vector?: string;
          is_system_message?: boolean;
          key_version?: number;
          read_at?: string | null;
          sender_id?: string;
          sequence_number?: number;
          system_message_type?: string | null;
        };
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
      oauth_states: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          ip_address: unknown;
          provider: string;
          return_url: string | null;
          session_id: string | null;
          state_token: string;
          used: boolean;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          ip_address?: unknown;
          provider: string;
          return_url?: string | null;
          session_id?: string | null;
          state_token: string;
          used?: boolean;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          ip_address?: unknown;
          provider?: string;
          return_url?: string | null;
          session_id?: string | null;
          state_token?: string;
          used?: boolean;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      payment_intents: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          customer_email: string;
          description: string | null;
          expires_at: string;
          id: string;
          idempotency_key: string | null;
          interval: string | null;
          metadata: Json | null;
          parent_intent_id: string | null;
          retry_count: number;
          template_user_id: string;
          type: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          customer_email: string;
          description?: string | null;
          expires_at?: string;
          id?: string;
          idempotency_key?: string | null;
          interval?: string | null;
          metadata?: Json | null;
          parent_intent_id?: string | null;
          retry_count?: number;
          template_user_id: string;
          type: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          customer_email?: string;
          description?: string | null;
          expires_at?: string;
          id?: string;
          idempotency_key?: string | null;
          interval?: string | null;
          metadata?: Json | null;
          parent_intent_id?: string | null;
          retry_count?: number;
          template_user_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_intents_parent_intent_id_fkey';
            columns: ['parent_intent_id'];
            isOneToOne: false;
            referencedRelation: 'payment_intents';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_provider_config: {
        Row: {
          config_status: string;
          created_at: string;
          enabled: boolean;
          features: Json | null;
          id: string;
          priority: number;
          provider: string;
          updated_at: string;
        };
        Insert: {
          config_status?: string;
          created_at?: string;
          enabled?: boolean;
          features?: Json | null;
          id?: string;
          priority?: number;
          provider: string;
          updated_at?: string;
        };
        Update: {
          config_status?: string;
          created_at?: string;
          enabled?: boolean;
          features?: Json | null;
          id?: string;
          priority?: number;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_results: {
        Row: {
          charged_amount: number | null;
          charged_currency: string | null;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          intent_id: string;
          provider: string;
          provider_fee: number | null;
          status: string;
          transaction_id: string;
          updated_at: string;
          verification_method: string | null;
          webhook_verified: boolean;
        };
        Insert: {
          charged_amount?: number | null;
          charged_currency?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          intent_id: string;
          provider: string;
          provider_fee?: number | null;
          status: string;
          transaction_id: string;
          updated_at?: string;
          verification_method?: string | null;
          webhook_verified?: boolean;
        };
        Update: {
          charged_amount?: number | null;
          charged_currency?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          intent_id?: string;
          provider?: string;
          provider_fee?: number | null;
          status?: string;
          transaction_id?: string;
          updated_at?: string;
          verification_method?: string | null;
          webhook_verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_results_intent_id_fkey';
            columns: ['intent_id'];
            isOneToOne: false;
            referencedRelation: 'payment_intents';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limit_attempts: {
        Row: {
          attempt_count: number;
          attempt_type: string;
          created_at: string;
          id: string;
          identifier: string;
          ip_address: unknown;
          locked_until: string | null;
          updated_at: string;
          user_agent: string | null;
          window_start: string;
        };
        Insert: {
          attempt_count?: number;
          attempt_type: string;
          created_at?: string;
          id?: string;
          identifier: string;
          ip_address?: unknown;
          locked_until?: string | null;
          updated_at?: string;
          user_agent?: string | null;
          window_start?: string;
        };
        Update: {
          attempt_count?: number;
          attempt_type?: string;
          created_at?: string;
          id?: string;
          identifier?: string;
          ip_address?: unknown;
          locked_until?: string | null;
          updated_at?: string;
          user_agent?: string | null;
          window_start?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          canceled_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          customer_email: string;
          failed_payment_count: number;
          grace_period_expires: string | null;
          id: string;
          next_billing_date: string | null;
          plan_amount: number;
          plan_interval: string;
          provider: string;
          provider_subscription_id: string;
          retry_schedule: Json | null;
          status: string;
          template_user_id: string;
          updated_at: string;
        };
        Insert: {
          canceled_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_email: string;
          failed_payment_count?: number;
          grace_period_expires?: string | null;
          id?: string;
          next_billing_date?: string | null;
          plan_amount: number;
          plan_interval: string;
          provider: string;
          provider_subscription_id: string;
          retry_schedule?: Json | null;
          status: string;
          template_user_id: string;
          updated_at?: string;
        };
        Update: {
          canceled_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_email?: string;
          failed_payment_count?: number;
          grace_period_expires?: string | null;
          id?: string;
          next_billing_date?: string | null;
          plan_amount?: number;
          plan_interval?: string;
          provider?: string;
          provider_subscription_id?: string;
          retry_schedule?: Json | null;
          status?: string;
          template_user_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      typing_indicators: {
        Row: {
          conversation_id: string;
          id: string;
          is_typing: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          id?: string;
          is_typing?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          id?: string;
          is_typing?: boolean;
          updated_at?: string;
          user_id?: string;
        };
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
      user_connections: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_connections_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_connections_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_encryption_keys: {
        Row: {
          created_at: string;
          device_id: string | null;
          encryption_salt: string | null;
          expires_at: string | null;
          id: string;
          public_key: Json;
          revoked: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_id?: string | null;
          encryption_salt?: string | null;
          expires_at?: string | null;
          id?: string;
          public_key: Json;
          revoked?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string | null;
          encryption_salt?: string | null;
          expires_at?: string | null;
          id?: string;
          public_key?: Json;
          revoked?: boolean;
          user_id?: string;
        };
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
      user_profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_admin: boolean;
          updated_at: string;
          username: string | null;
          welcome_message_sent: boolean;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_admin?: boolean;
          updated_at?: string;
          username?: string | null;
          welcome_message_sent?: boolean;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_admin?: boolean;
          updated_at?: string;
          username?: string | null;
          welcome_message_sent?: boolean;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          created_at: string;
          event_data: Json;
          event_type: string;
          id: string;
          last_retry_at: string | null;
          next_retry_at: string | null;
          permanently_failed: boolean;
          processed: boolean;
          processed_at: string | null;
          processing_attempts: number;
          processing_error: string | null;
          provider: string;
          provider_event_id: string;
          related_payment_id: string | null;
          related_subscription_id: string | null;
          retry_count: number;
          signature: string;
          signature_verified: boolean;
        };
        Insert: {
          created_at?: string;
          event_data: Json;
          event_type: string;
          id?: string;
          last_retry_at?: string | null;
          next_retry_at?: string | null;
          permanently_failed?: boolean;
          processed?: boolean;
          processed_at?: string | null;
          processing_attempts?: number;
          processing_error?: string | null;
          provider: string;
          provider_event_id: string;
          related_payment_id?: string | null;
          related_subscription_id?: string | null;
          retry_count?: number;
          signature: string;
          signature_verified?: boolean;
        };
        Update: {
          created_at?: string;
          event_data?: Json;
          event_type?: string;
          id?: string;
          last_retry_at?: string | null;
          next_retry_at?: string | null;
          permanently_failed?: boolean;
          processed?: boolean;
          processed_at?: string | null;
          processing_attempts?: number;
          processing_error?: string | null;
          provider?: string;
          provider_event_id?: string;
          related_payment_id?: string | null;
          related_subscription_id?: string | null;
          retry_count?: number;
          signature?: string;
          signature_verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'webhook_events_related_payment_id_fkey';
            columns: ['related_payment_id'];
            isOneToOne: false;
            referencedRelation: 'payment_results';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'webhook_events_related_subscription_id_fkey';
            columns: ['related_subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_audit_trends: {
        Args: {
          p_burst_gap?: string;
          p_burst_min_attempts?: number;
          p_end?: string;
          p_start?: string;
        };
        Returns: Json;
      };
      admin_auth_stats: { Args: never; Returns: Json };
      admin_conversation_list: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string };
        Returns: Json;
      };
      admin_messaging_stats: { Args: never; Returns: Json };
      admin_messaging_trends: {
        Args: { p_end?: string; p_start?: string; p_top_limit?: number };
        Returns: Json;
      };
      admin_overview: {
        Args: { p_end?: string; p_start?: string };
        Returns: Json;
      };
      admin_payment_stats: { Args: never; Returns: Json };
      admin_payment_trends: {
        Args: { p_end?: string; p_start?: string };
        Returns: Json;
      };
      admin_user_stats: { Args: never; Returns: Json };
      check_rate_limit: {
        Args: {
          p_attempt_type: string;
          p_identifier: string;
          p_ip_address?: unknown;
        };
        Returns: Json;
      };
      cleanup_old_audit_logs: { Args: never; Returns: undefined };
      is_conversation_member: {
        Args: { check_user_id?: string; conv_id: string };
        Returns: boolean;
      };
      is_conversation_owner: {
        Args: { check_user_id?: string; conv_id: string };
        Returns: boolean;
      };
      record_failed_attempt: {
        Args: {
          p_attempt_type: string;
          p_identifier: string;
          p_ip_address?: unknown;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
