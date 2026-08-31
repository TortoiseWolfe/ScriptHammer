import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRpcData } from './admin-rpc-result';

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
    // `throw new Error(...)`, not `throw error`. A PostgrestError is a plain
    // object, so anything catching it and stringifying gets "[object Object]" —
    // its sibling listUsers() already wrapped, and the inconsistency is what hid
    // the cause of #1029 for a round. Code and hint are kept: 42501 and "permission
    // denied for function" are different diagnoses with the same HTTP status.
    if (error)
      throw new Error(
        [error.message, error.code ? `code=${error.code}` : null, error.hint]
          .filter(Boolean)
          .join(' | ')
      );
    return requireRpcData<AdminUserStats>(data, 'admin_user_stats', [
      'total_users',
    ]);
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
    return requireRpcData<AdminUserListResult>(data, 'admin_list_users', [
      'total',
      'users',
    ]);
  }
}
