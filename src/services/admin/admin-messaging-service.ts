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
}
