/**
 * Payment Service
 * High-level API for payment operations with offline support
 */

import { supabase, isSupabaseOnline } from '@/lib/supabase/client';
import { queueOperation } from './offline-queue';
import type {
  CreatePaymentIntentInput,
  PaymentIntent,
  PaymentResult,
  PaymentActivity,
  Currency,
  PaymentType,
  PaymentInterval,
} from '@/types/payment';
import { validatePaymentAmount, validateCurrency } from '@/config/payment';

/**
 * Create a payment intent
 * Queues operation if offline
 */
export async function createPaymentIntent(
  amount: number,
  currency: Currency,
  type: PaymentType,
  customerEmail: string,
  options?: {
    interval?: PaymentInterval;
    description?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<PaymentIntent> {
  // Validate inputs
  validatePaymentAmount(amount);
  validateCurrency(currency);

  // Sanitize email (prevent injection, normalize for deduplication)
  const sanitizedEmail = customerEmail.trim().toLowerCase();
  if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    throw new Error('Invalid email address');
  }

  // Validate metadata (prevent resource exhaustion)
  if (options?.metadata) {
    const metadataStr = JSON.stringify(options.metadata);
    if (metadataStr.length > 1024) {
      throw new Error('Metadata exceeds 1KB limit');
    }
    const checkNesting = (obj: unknown, depth = 0): void => {
      if (depth > 2) throw new Error('Metadata nesting exceeds 2 levels');
      if (obj && typeof obj === 'object') {
        Object.values(obj).forEach((v) => checkNesting(v, depth + 1));
      }
    };
    checkNesting(options.metadata);
  }

  const intentData: CreatePaymentIntentInput = {
    amount,
    currency,
    type,
    customer_email: sanitizedEmail,
    interval: options?.interval,
    description: options?.description,
    metadata: options?.metadata,
  };

  // Check if online
  const isOnline = await isSupabaseOnline();

  if (!isOnline) {
    // Queue for later
    await queueOperation('payment_intent', intentData);
    throw new Error(
      'You are offline. Payment has been queued and will be processed when connection returns.'
    );
  }

  try {
    const { data, error } = await supabase
      .from('payment_intents')
      .insert({
        amount: intentData.amount,
        currency: intentData.currency,
        type: intentData.type,
        interval: intentData.interval || null,
        customer_email: intentData.customer_email,
        description: intentData.description || null,
        metadata: intentData.metadata || {},
        template_user_id: '00000000-0000-0000-0000-000000000000', // TODO: Get from auth
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    // If network error, queue it
    if (
      error instanceof Error &&
      (error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED'))
    ) {
      await queueOperation('payment_intent', intentData);
      throw new Error(
        'Network error. Payment has been queued and will be processed when connection returns.'
      );
    }
    throw error;
  }
}

/**
 * Get payment status by intent ID
 */
export async function getPaymentStatus(
  intentId: string
): Promise<PaymentResult | null> {
  const { data, error } = await supabase
    .from('payment_results')
    .select('*')
    .eq('intent_id', intentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Cancel a pending payment intent
 */
export async function cancelPaymentIntent(intentId: string): Promise<void> {
  // Check if payment already processed
  const status = await getPaymentStatus(intentId);
  if (status) {
    throw new Error('Cannot cancel - payment already processed');
  }

  // Delete the intent (before expiration)
  const { error } = await supabase
    .from('payment_intents')
    .delete()
    .eq('id', intentId);

  if (error) throw error;
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(
  userId: string,
  limit = 20
): Promise<PaymentActivity[]> {
  const { data, error } = await supabase
    .from('payment_results')
    .select(
      `
      id,
      provider,
      transaction_id,
      status,
      charged_amount,
      charged_currency,
      webhook_verified,
      created_at,
      intent:payment_intents!inner(customer_email)
    `
    )
    .eq('payment_intents.template_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.map((item) => ({
    id: item.id,
    provider: item.provider as PaymentActivity['provider'],
    transaction_id: item.transaction_id,
    status: item.status as PaymentActivity['status'],
    charged_amount: item.charged_amount,
    charged_currency: item.charged_currency as Currency,
    customer_email: (item.intent as any).customer_email,
    webhook_verified: item.webhook_verified,
    created_at: item.created_at,
  }));
}

/**
 * Retry a failed payment
 */
export async function retryFailedPayment(
  intentId: string
): Promise<PaymentIntent> {
  // Get original intent
  const { data: originalIntent, error: fetchError } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (fetchError) throw fetchError;

  // Create new intent with same data
  return await createPaymentIntent(
    originalIntent.amount,
    originalIntent.currency as Currency,
    originalIntent.type as PaymentType,
    originalIntent.customer_email,
    {
      interval: originalIntent.interval as PaymentInterval | undefined,
      description: originalIntent.description || undefined,
      metadata:
        (originalIntent.metadata as Record<string, unknown>) || undefined,
    }
  );
}

/**
 * Get payment intent by ID
 */
export async function getPaymentIntent(
  intentId: string
): Promise<PaymentIntent | null> {
  const { data, error } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Check if payment intent has expired
 */
export function isPaymentIntentExpired(intent: PaymentIntent): boolean {
  const expiresAt = new Date(intent.expires_at);
  return expiresAt < new Date();
}

/**
 * Format currency for display
 */
export function formatPaymentAmount(
  amountInCents: number,
  currency: Currency
): string {
  const amount = amountInCents / 100;
  const currencySymbols: Record<Currency, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
    cad: 'CA$',
    aud: 'AU$',
  };
  const symbol = currencySymbols[currency];
  return `${symbol}${amount.toFixed(2)}`;
}
