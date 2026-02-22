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
