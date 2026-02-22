import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminUserStats {
  total_users: number;
  active_this_week: number;
  pending_connections: number;
  total_connections: number;
}

export interface AdminUserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  created_at: string;
  welcome_message_sent: boolean;
}

export class AdminUserService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminUserService not initialized');
  }

  async getStats(): Promise<AdminUserStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_user_stats');
    if (error) throw error;
    return data as AdminUserStats;
  }

  async getUsers(limit = 50): Promise<AdminUserRow[]> {
    this.ensureInitialized();
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('id, username, display_name, created_at, welcome_message_sent')
      .eq('is_admin', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AdminUserRow[];
  }
}
