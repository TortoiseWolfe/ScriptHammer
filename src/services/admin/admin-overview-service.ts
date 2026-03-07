import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminPaymentStats } from './admin-payment-service';
import type { AdminAuthStats } from './admin-audit-service';
import type { AdminUserStats } from './admin-user-service';
import type { AdminMessagingStats } from './admin-messaging-service';

/**
 * Four integer arrays, one point per day in the range, oldest → newest,
 * zero-filled. Plain number[] because the Sparkline index-maps x — it
 * doesn't need the dates. Default range is 7 days / 7 elements; a
 * custom range produces longer arrays and the Sparkline just draws a
 * denser polyline.
 */
export interface OverviewSparks {
  /** Successful payments per day */
  payments: number[];
  /** Successful sign-ins per day */
  logins: number[];
  /** New user signups per day (user_profiles.created_at, excludes admin) */
  signups: number[];
  /** Non-deleted messages per day */
  messages: number[];
}

/** A single day–count pair for the overview trend charts. */
export interface OverviewTrendPoint {
  day: string;   // YYYY-MM-DD
  count: number;
}

/** Trend series keyed by domain, derived from sparks + range. */
export interface OverviewTrends {
  payments_daily: OverviewTrendPoint[];
  logins_daily: OverviewTrendPoint[];
  signups_daily: OverviewTrendPoint[];
  messages_daily: OverviewTrendPoint[];
}

export interface AdminOverview {
  /**
   * Day-truncated window the SQL actually used. Echoed back even when
   * the caller omitted bounds (defaults to [today-6, today]).
   */
  range: { start: string; end: string };
  payments: AdminPaymentStats;
  auth: AdminAuthStats;
  users: AdminUserStats;
  messaging: AdminMessagingStats;
  sparks: OverviewSparks;
  /** Derived client-side from sparks + range for the trend charts. */
  trends: OverviewTrends;
}

/**
 * One RPC, all four domains. Replaces four separate service calls on the
 * overview page. The SQL composes the existing *_stats() functions
 * server-side so if one of them changes, this inherits.
 */
export class AdminOverviewService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminOverviewService not initialized');
  }

  async getOverview(start?: Date, end?: Date): Promise<AdminOverview> {
    this.ensureInitialized();

    // Omit absent keys — sending p_start: undefined serializes as null
    // and overrides DEFAULT NULL on the PG side. Omission lets the SQL's
    // COALESCE fall through to its [today-6, today] default per bound.
    const params: { p_start?: string; p_end?: string } = {};
    if (start) params.p_start = start.toISOString();
    if (end) params.p_end = end.toISOString();

    const { data, error } = await this.supabase.rpc('admin_overview', params);
    if (error) throw new Error(error.message);

    const raw = data as Omit<AdminOverview, 'trends'> & { sparks: OverviewSparks; range: { start: string; end: string } };

    // Transform sparks (number[]) into OverviewTrendPoint[] using the range start date.
    const startDate = new Date(raw.range.start);
    const toPoints = (arr: number[]): OverviewTrendPoint[] =>
      (arr ?? []).map((count, i) => {
        const d = new Date(startDate.getTime() + i * 86_400_000);
        const day = d.toISOString().slice(0, 10);
        return { day, count };
      });

    const sparks = raw.sparks ?? { payments: [], logins: [], signups: [], messages: [] };

    return {
      ...raw,
      trends: {
        payments_daily: toPoints(sparks.payments),
        logins_daily: toPoints(sparks.logins),
        signups_daily: toPoints(sparks.signups),
        messages_daily: toPoints(sparks.messages),
      },
    };
  }
}
