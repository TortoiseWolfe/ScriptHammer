import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminMessagingStats {
  total_conversations: number;
  group_conversations: number;
  direct_conversations: number;
  messages_this_week: number;
  active_connections: number;
  blocked_connections: number;
  connection_distribution: Record<string, number>;
}

/**
 * Aggregate volume per sender. Deliberately NO conversation_id and NO
 * recipient dimension — the admin sees who is noisy, not who they're
 * noisy at. That's the line between "traffic metadata" and "social graph".
 */
export interface TopSender {
  user_id: string;
  username: string | null;
  display_name: string | null;
  messages: number;
}

export interface DailyMessagingPoint {
  day: string; // YYYY-MM-DD
  messages: number;
  conversations_created: number;
}

export interface AdminMessagingTrends {
  range: { start: string; end: string };
  totals: {
    messages: number;
    conversations_created: number;
    /** COUNT(DISTINCT sender_id) over the range — not total users. */
    active_senders: number;
  };
  daily_series: DailyMessagingPoint[];
  top_senders: TopSender[];
}

/**
 * One row per conversation for the admin drill-down list.
 *
 * Exposes `conversation_id` (which the trends RPC refuses to) because
 * per-row drill-down was the explicit ask. Still does NOT expose
 * participant identities — the admin sees which channels are noisy, not
 * who's in them. The `Record<string, unknown>` extension is for
 * AdminDataTable's generic constraint.
 */
export interface AdminConversationRow extends Record<string, unknown> {
  conversation_id: string;
  is_group: boolean;
  participant_count: number;
  message_count: number;
  /** ISO timestamp — `last_message_at`, or `created_at` if never messaged. */
  last_activity: string;
  created_at: string;
}

export interface AdminConversationList {
  /** Total rows ignoring limit/offset — drives "showing N of M". */
  total: number;
  conversations: AdminConversationRow[];
}

export class AdminMessagingService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminMessagingService not initialized');
  }

  async getStats(): Promise<AdminMessagingStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_messaging_stats');
    if (error) throw error;
    return data as AdminMessagingStats;
  }

  async getTrends(start?: Date, end?: Date): Promise<AdminMessagingTrends> {
    this.ensureInitialized();

    const params: { p_start?: string; p_end?: string } = {};
    if (start) params.p_start = start.toISOString();
    if (end) params.p_end = end.toISOString();

    const { data, error } = await this.supabase.rpc(
      'admin_messaging_trends',
      params
    );
    if (error) throw new Error(error.message);
    return data as AdminMessagingTrends;
  }

  async getConversationList(
    opts: { limit?: number; offset?: number } = {}
  ): Promise<AdminConversationList> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc(
      'admin_conversation_list',
      { p_limit: opts.limit ?? 50, p_offset: opts.offset ?? 0 }
    );
    if (error) throw new Error(error.message);
    return data as AdminConversationList;
  }
}
