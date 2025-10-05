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
    PostgrestVersion: '13.0.5';
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
      payment_intents: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          customer_email: string;
          description: string | null;
          expires_at: string;
          id: string;
          interval: string | null;
          metadata: Json | null;
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
          interval?: string | null;
          metadata?: Json | null;
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
          interval?: string | null;
          metadata?: Json | null;
          template_user_id?: string;
          type?: string;
        };
        Relationships: [];
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
      webhook_events: {
        Row: {
          created_at: string;
          event_data: Json;
          event_type: string;
          id: string;
          processed: boolean;
          processed_at: string | null;
          processing_attempts: number;
          processing_error: string | null;
          provider: string;
          provider_event_id: string;
          related_payment_id: string | null;
          related_subscription_id: string | null;
          signature: string;
          signature_verified: boolean;
        };
        Insert: {
          created_at?: string;
          event_data: Json;
          event_type: string;
          id?: string;
          processed?: boolean;
          processed_at?: string | null;
          processing_attempts?: number;
          processing_error?: string | null;
          provider: string;
          provider_event_id: string;
          related_payment_id?: string | null;
          related_subscription_id?: string | null;
          signature: string;
          signature_verified?: boolean;
        };
        Update: {
          created_at?: string;
          event_data?: Json;
          event_type?: string;
          id?: string;
          processed?: boolean;
          processed_at?: string | null;
          processing_attempts?: number;
          processing_error?: string | null;
          provider?: string;
          provider_event_id?: string;
          related_payment_id?: string | null;
          related_subscription_id?: string | null;
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
      user_profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      auth_audit_logs: {
        Row: {
          created_at: string;
          event_data: Json | null;
          event_type: string;
          id: string;
          ip_address: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_data?: Json | null;
          event_type: string;
          id?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_data?: Json | null;
          event_type?: string;
          id?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'auth_audit_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_user: {
        Args: Record<PropertyKey, never>;
        Returns: void;
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
