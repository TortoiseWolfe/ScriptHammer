import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentActivity } from '@/types/payment';

export interface AdminPaymentStats {
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  pending_payments: number;
  total_revenue_cents: number;
  active_subscriptions: number;
  failed_this_week: number;
  revenue_by_provider: Record<string, number>;
}

export interface ProviderBreakdown {
  provider: string;
  succeeded: number;
  failed: number;
  refunded: number;
  revenue_cents: number;
}

export interface DailyPaymentPoint {
  day: string; // YYYY-MM-DD
  succeeded: number;
  failed: number;
  revenue_cents: number;
}

export interface AdminPaymentTrends {
  range: { start: string; end: string };
  totals: {
    succeeded: number;
    failed: number;
    refunded: number;
    revenue_cents: number;
  };
  refund_rate: number;
  provider_breakdown: ProviderBreakdown[];
  daily_series: DailyPaymentPoint[];
}

export class AdminPaymentService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  private ensureInitialized(): void {
    if (!this.userId) throw new Error('AdminPaymentService not initialized');
  }

  async getStats(): Promise<AdminPaymentStats> {
    this.ensureInitialized();
    const { data, error } = await this.supabase.rpc('admin_payment_stats');
    if (error) throw error;
    return data as AdminPaymentStats;
  }

  async getTrends(start?: Date, end?: Date): Promise<AdminPaymentTrends> {
    this.ensureInitialized();

    const params: { p_start?: string; p_end?: string } = {};
    if (start) params.p_start = start.toISOString();
    if (end) params.p_end = end.toISOString();

    const { data, error } = await this.supabase.rpc(
      'admin_payment_trends',
      params
    );
    if (error) throw new Error(error.message);

    const raw = data as Omit<AdminPaymentTrends, 'refund_rate'> & {
      refund_rate: number | string;
    };
    // Postgres numeric → JSON can arrive as a string depending on driver path.
    return { ...raw, refund_rate: Number(raw.refund_rate) };
  }

  async getRecentTransactions(limit = 50): Promise<PaymentActivity[]> {
    this.ensureInitialized();
    const { data, error } = await this.supabase
      .from('payment_results')
      .select(
        `id, provider, transaction_id, status, charged_amount, charged_currency, webhook_verified, created_at, payment_intents(customer_email)`
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      provider: r.provider as string,
      transaction_id: r.transaction_id as string,
      status: r.status as string,
      charged_amount: r.charged_amount as number,
      charged_currency: r.charged_currency as string,
      customer_email:
        (r.payment_intents as Record<string, string> | null)?.customer_email ??
        '',
      webhook_verified: r.webhook_verified as boolean,
      created_at: r.created_at as string,
    })) as PaymentActivity[];
  }
}
