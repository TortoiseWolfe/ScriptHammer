/**
 * Payment Service
 * High-level API for payment operations with offline support
 */

import { supabase, isSupabaseOnline } from '@/lib/supabase/client';
import { queueOperation } from './offline-queue';
import type { Json } from '@/lib/supabase/types';
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
import { validateAndSanitizeMetadata } from './metadata-validator';

/**
 * Get authenticated user ID
 * @throws Error if user not authenticated
 */
async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required for payment operations');
  }

  return user.id;
}

/**
 * Create a payment intent
 * Queues operation if offline
 * REQ-SEC-001: Requires authentication, uses RLS for data isolation
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
  // Require authentication (REQ-SEC-001)
  const userId = await getAuthenticatedUserId();

  // Validate inputs
  validatePaymentAmount(amount);
  validateCurrency(currency);

  // Sanitize email (prevent injection, normalize for deduplication)
  const sanitizedEmail = customerEmail.trim().toLowerCase();
  if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    throw new Error('Invalid email address');
  }

  // Validate metadata (REQ-SEC-005: prevent prototype pollution and resource exhaustion)
  let sanitizedMetadata: Record<string, unknown> = {};
  if (options?.metadata) {
    try {
      // validateAndSanitizeMetadata throws on validation error and returns sanitized metadata
      sanitizedMetadata = validateAndSanitizeMetadata(options.metadata);
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Invalid metadata'
      );
    }
  }

  const intentData: CreatePaymentIntentInput = {
    amount,
    currency,
    type,
    customer_email: sanitizedEmail,
    interval: options?.interval,
    description: options?.description,
    metadata: sanitizedMetadata,
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
        metadata: (intentData.metadata || {}) as Json,
        template_user_id: userId, // REQ-SEC-001: Use authenticated user ID
      })
      .select()
      .single();

    if (error) throw error;
    return data as PaymentIntent;
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
 * REQ-SEC-001: Requires authentication, RLS ensures user owns the intent
 */
export async function getPaymentStatus(
  intentId: string
): Promise<PaymentResult | null> {
  // Require authentication (REQ-SEC-001)
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('payment_results')
    .select('*')
    .eq('intent_id', intentId)
    .maybeSingle();

  if (error) throw error;
  return data as PaymentResult | null;
}

/**
 * Cancel a pending payment intent
 * REQ-SEC-001: Requires authentication, RLS ensures user owns the intent
 */
export async function cancelPaymentIntent(intentId: string): Promise<void> {
  // Require authentication (REQ-SEC-001)
  await getAuthenticatedUserId();

  // Check if payment already processed
  const status = await getPaymentStatus(intentId);
  if (status) {
    throw new Error('Cannot cancel - payment already processed');
  }

  // Delete the intent (before expiration)
  // RLS policy ensures user can only delete their own intents
  const { error } = await supabase
    .from('payment_intents')
    .delete()
    .eq('id', intentId);

  if (error) throw error;
}

/**
 * Get payment history for authenticated user
 * REQ-SEC-001: Uses authenticated user ID, protected by RLS
 */
export async function getPaymentHistory(
  limit = 20
): Promise<PaymentActivity[]> {
  // Require authentication (REQ-SEC-001)
  const userId = await getAuthenticatedUserId();

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
    charged_amount: item.charged_amount ?? 0,
    charged_currency: item.charged_currency as Currency,
    customer_email: (item.intent as any).customer_email,
    webhook_verified: item.webhook_verified,
    created_at: item.created_at,
  }));
}

/**
 * Retry a failed payment
 * REQ-SEC-001: Requires authentication, RLS ensures user owns the intent
 */
export async function retryFailedPayment(
  intentId: string
): Promise<PaymentIntent> {
  // Require authentication (REQ-SEC-001)
  await getAuthenticatedUserId();

  // Get original intent (RLS ensures user owns it)
  const { data: originalIntent, error: fetchError } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (fetchError) throw fetchError;

  // Create new intent with same data
  // createPaymentIntent will use the authenticated user's ID
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
 * REQ-SEC-001: Requires authentication, RLS ensures user owns the intent
 */
export async function getPaymentIntent(
  intentId: string
): Promise<PaymentIntent | null> {
  // Require authentication (REQ-SEC-001)
  await getAuthenticatedUserId();

  // RLS policy ensures user can only access their own intents
  const { data, error } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();

  if (error) throw error;
  return data as PaymentIntent | null;
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
