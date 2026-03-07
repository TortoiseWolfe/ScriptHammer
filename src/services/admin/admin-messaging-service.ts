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
}
