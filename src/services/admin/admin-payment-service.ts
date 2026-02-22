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
