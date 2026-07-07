import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminUserStats {
  total_users: number;
  active_this_week: number;
  pending_connections: number;
  total_connections: number;
}

export type UserActivity = 'active' | 'idle' | 'dormant';

export interface AdminUserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  created_at: string;
  welcome_message_sent: boolean;
  /** From auth.users — NULL means signed up but never signed in. */
  last_sign_in_at: string | null;
  /** Computed in SQL: active ≤7d, idle 7–30d, dormant >30d or never. */
  activity: UserActivity;
}

export interface AdminUserListResult {
  /** Search-filtered count ignoring limit/offset — for "showing N of M". */
  total: number;
  users: AdminUserRow[];
}

export interface ListUsersParams {
  search?: string;
  limit?: number;
  offset?: number;
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

  async listUsers(opts: ListUsersParams = {}): Promise<AdminUserListResult> {
    this.ensureInitialized();

    const params: { p_search?: string; p_limit?: number; p_offset?: number } =
      {};
    const search = opts.search?.trim();
    if (search) params.p_search = search;
    if (opts.limit !== undefined) params.p_limit = opts.limit;
    if (opts.offset !== undefined) params.p_offset = opts.offset;

    const { data, error } = await this.supabase.rpc('admin_list_users', params);
    if (error) throw new Error(error.message);
    return data as AdminUserListResult;
  }
}
