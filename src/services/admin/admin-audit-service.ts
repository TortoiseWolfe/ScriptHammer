import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminAuthStats {
  logins_today: number;
  failed_this_week: number;
  signups_this_month: number;
  rate_limited_users: number;
  top_failed_logins: { user_id: string; attempts: number }[];
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  created_at: string;
}

/**
 * A contiguous run of failed sign-ins from one IP where no two consecutive
 * attempts are more than the burst gap apart (gaps-and-islands sessionized).
 *
 * distinct_users is the triage signal:
 *   1  → someone hammering a specific account
 *   >1 → credential stuffing / spray across accounts
 * COUNT(DISTINCT user_id) ignores NULL in the SQL, so failed logins against
 * unknown emails don't inflate this number.
 */
export interface AuditBurst {
  ip_address: string;
  first_seen: string;
  last_seen: string;
  attempts: number;
  distinct_users: number;
}

export interface DailyAuditPoint {
  day: string; // YYYY-MM-DD
  failed: number;
  succeeded: number;
}

export interface AdminAuditTrends {
  range: { start: string; end: string };
  totals: {
    sign_in_failed: number;
    sign_in_success: number;
    bursts: number;
  };
  bursts: AuditBurst[];
  daily_series: DailyAuditPoint[];
}

export class AdminAuditService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminAuditService not initialized');
  }

  async getStats(): Promise<AdminAuthStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_auth_stats');
    if (error) throw error;
    return data as AdminAuthStats;
  }

  async getTrends(start?: Date, end?: Date): Promise<AdminAuditTrends> {
    this.ensureInitialized();

    const params: { p_start?: string; p_end?: string } = {};
    if (start) params.p_start = start.toISOString();
    if (end) params.p_end = end.toISOString();

    const { data, error } = await this.supabase.rpc(
      'admin_audit_trends',
      params
    );
    if (error) throw new Error(error.message);
    return data as AdminAuditTrends;
  }

  async getRecentEvents(
    limit = 100,
    eventType?: string
  ): Promise<AuditLogEntry[]> {
    this.ensureInitialized();
    let query = this.supabase
      .from('auth_audit_logs')
      .select('id, user_id, event_type, success, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (eventType) query = query.eq('event_type', eventType);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AuditLogEntry[];
  }
}
