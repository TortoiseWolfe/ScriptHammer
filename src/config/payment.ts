/**
 * Payment Integration Configuration
 * Centralizes all payment-related environment variables and validation
 *
 * ## Security Classification
 *
 * ### Public Variables (Safe for Client-Side)
 * These use NEXT_PUBLIC_ prefix and are bundled into the client:
 * - NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anonymous key (RLS protected)
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY - Stripe publishable key
 * - NEXT_PUBLIC_PAYPAL_CLIENT_ID - PayPal client ID
 * - NEXT_PUBLIC_CASHAPP_CASHTAG - Cash App cashtag
 * - NEXT_PUBLIC_CHIME_SIGN - Chime sign
 *
 * ### Private Variables (Server-Only - NEVER expose to client)
 * These must NEVER be prefixed with NEXT_PUBLIC_:
 * - SUPABASE_SERVICE_ROLE_KEY - Full database access, bypasses RLS
 * - STRIPE_SECRET_KEY - Can create charges, refunds, read customer data
 * - STRIPE_WEBHOOK_SECRET - Validates webhook signatures
 * - PAYPAL_CLIENT_SECRET - PayPal API authentication
 * - PAYPAL_WEBHOOK_ID - Validates PayPal webhooks
 * - RESEND_API_KEY - Email sending capability
 *
 * @see .github/SECURITY.md for security guidelines
 */

import type { Currency, PaymentInterval } from '@/types/payment';
import { createLogger } from '@/lib/logger';

const logger = createLogger('config:payment');

// ============================================================================
// Supabase Configuration
// ============================================================================

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '', // Server-side only
} as const;

/**
 * Validates Supabase configuration
 * @throws Error if configuration is invalid
 */
export function validateSupabaseConfig(): void {
  if (!supabaseConfig.url) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please set it in .env'
    );
  }
  if (!supabaseConfig.anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please set it in .env'
    );
  }
  // Service role key validation only on server-side (Edge Functions)
  if (typeof window === 'undefined' && !supabaseConfig.serviceRoleKey) {
    logger.warn(
      'Missing SUPABASE_SERVICE_ROLE_KEY - webhook handlers may not work'
    );
  }
}

// ============================================================================
// Stripe Configuration
// ============================================================================

export const stripeConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  // NO subscriptionPriceId. It used to hold NEXT_PUBLIC_STRIPE_PRICE_ID and was
  // read for EVERY recurring SKU, so three Care Plan tiers at $49/$99/$249 would
  // all have billed whatever that one variable pointed at (#772). The price now
  // comes from `products.stripe_price_id`, resolved server-side in
  // create-stripe-subscription — the client never names a price, which also
  // closes #559 T024 (the server used to accept any price the request named).
  secretKey: process.env.STRIPE_SECRET_KEY || '', // Server-side only
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '', // Server-side only
} as const;

/**
 * Validates Stripe configuration
 * @param serverSide - Whether to validate server-side keys
 * @throws Error if configuration is invalid
 */
export function validateStripeConfig(serverSide = false): void {
  if (!stripeConfig.publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable'
    );
  }
  if (serverSide) {
    if (!stripeConfig.secretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable');
    }
    if (!stripeConfig.webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    }
  }
}

// ============================================================================
// PayPal Configuration
// ============================================================================

export const paypalConfig = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
  // Recurring billing Plan (operator-created in the PayPal dashboard / API);
  // the plan amount + interval live on the Plan object. Empty → the recurring
  // PayPal path shows a clear "not configured" error instead of silently
  // creating a one-time order.
  //
  // ⚠️ THIS IS THE SAME DEFECT #772 FIXED ON THE STRIPE LANE, STILL OPEN HERE.
  // One global plan id is read for EVERY recurring SKU, so three PayPal tiers
  // would all bill whatever this points at. `products.paypal_plan_id` already
  // exists for the per-SKU value; the fix mirrors create-stripe-subscription's
  // resolver. Not fixed in this PR only to keep it reviewable.
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || '', // Server-side only
  webhookId: process.env.PAYPAL_WEBHOOK_ID || '', // Server-side only
} as const;

/**
 * Validates PayPal configuration
 * @param serverSide - Whether to validate server-side keys
 * @throws Error if configuration is invalid
 */
export function validatePayPalConfig(serverSide = false): void {
  if (!paypalConfig.clientId) {
    throw new Error(
      'Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID environment variable'
    );
  }
  if (serverSide) {
    if (!paypalConfig.clientSecret) {
      throw new Error('Missing PAYPAL_CLIENT_SECRET environment variable');
    }
    if (!paypalConfig.webhookId) {
      throw new Error('Missing PAYPAL_WEBHOOK_ID environment variable');
    }
  }
}

// ============================================================================
// Cash App / Chime Configuration
// ============================================================================

export const directPaymentConfig = {
  cashAppCashtag: process.env.NEXT_PUBLIC_CASHAPP_CASHTAG || '',
  chimeSign: process.env.NEXT_PUBLIC_CHIME_SIGN || '',
} as const;

/**
 * Returns Cash App payment link
 * @param amount - Optional amount in cents
 */
export function getCashAppLink(amount?: number): string {
  if (!directPaymentConfig.cashAppCashtag) {
    throw new Error('Cash App cashtag not configured');
  }
  const baseUrl = `https://cash.app/${directPaymentConfig.cashAppCashtag}`;
  return amount ? `${baseUrl}/${(amount / 100).toFixed(2)}` : baseUrl;
}

/**
 * Returns Chime payment link
 */
export function getChimeLink(): string {
  if (!directPaymentConfig.chimeSign) {
    throw new Error('Chime sign not configured');
  }
  return `https://chime.com/pay/${directPaymentConfig.chimeSign}`;
}

// ============================================================================
// Email Configuration (Resend)
// ============================================================================

export const emailConfig = {
  resendApiKey: process.env.RESEND_API_KEY || '', // Server-side only
} as const;

/**
 * Validates email configuration
 * @throws Error if configuration is invalid
 */
export function validateEmailConfig(): void {
  if (!emailConfig.resendApiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable');
  }
}

// ============================================================================
// Payment Limits & Defaults
// ============================================================================

export const paymentLimits = {
  minAmount: 100, // $1.00 in cents
  // $3,500.00 in cents — exactly the most expensive catalog item (svc-site).
  //
  // Deliberately NOT a round number with headroom. The ceiling bounds the damage
  // when something goes wrong; setting it far above real revenue means a bug can
  // charge far above real revenue. scripts/__tests__/payment-ceiling.test.js keeps
  // it in step with the catalog (#557).
  //
  // THIS IS DOCUMENTATION, NOT ENFORCEMENT. validatePaymentAmount() below is
  // called from payment-service.ts, which runs in the BROWSER — a tampered
  // client skips it entirely. The only real control is the CHECK constraint on
  // payment_intents.amount. Keep this in step with the migration so the two do
  // not drift, but never rely on it.
  maxAmount: 350_000,
} as const;

export const supportedCurrencies: Currency[] = [
  'usd',
  'eur',
  'gbp',
  'cad',
  'aud',
];

export const supportedIntervals: PaymentInterval[] = ['month', 'year'];

/**
 * Validates payment amount
 * @param amount - Amount in cents
 * @throws Error if amount is out of range
 */
export function validatePaymentAmount(amount: number): void {
  if (amount < paymentLimits.minAmount) {
    throw new Error(
      `Payment amount must be at least $${(paymentLimits.minAmount / 100).toFixed(2)}`
    );
  }
  if (amount > paymentLimits.maxAmount) {
    throw new Error(
      `Payment amount must be at most $${(paymentLimits.maxAmount / 100).toFixed(2)}`
    );
  }
}

/**
 * Validates currency
 * @param currency - Currency code
 * @throws Error if currency not supported
 */
export function validateCurrency(
  currency: string
): asserts currency is Currency {
  if (!supportedCurrencies.includes(currency as Currency)) {
    throw new Error(
      `Currency '${currency}' not supported. Supported currencies: ${supportedCurrencies.join(', ')}`
    );
  }
}

// ============================================================================
// Subscription Retry & Grace Period
// ============================================================================

export const subscriptionConfig = {
  retrySchedule: [1, 3, 7], // Days after failure
  gracePeriodDays: 7, // Days after final retry
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

export const featureFlags = {
  stripeEnabled: !!stripeConfig.publishableKey,
  paypalEnabled: !!paypalConfig.clientId,
  cashAppEnabled: !!directPaymentConfig.cashAppCashtag,
  chimeEnabled: !!directPaymentConfig.chimeSign,
} as const;

/**
 * Returns list of enabled payment providers
 */
export function getEnabledProviders(): string[] {
  const providers: string[] = [];
  if (featureFlags.stripeEnabled) providers.push('stripe');
  if (featureFlags.paypalEnabled) providers.push('paypal');
  if (featureFlags.cashAppEnabled) providers.push('cashapp');
  if (featureFlags.chimeEnabled) providers.push('chime');
  return providers;
}

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validates all required payment configuration
 * Call this at app initialization to fail fast
 * @param serverSide - Whether to validate server-side secrets
 */
export function validatePaymentConfig(serverSide = false): void {
  try {
    validateSupabaseConfig();

    // At least one payment provider must be configured
    const enabledProviders = getEnabledProviders();
    if (enabledProviders.length === 0) {
      throw new Error(
        'No payment providers configured. Please set at least one provider in .env'
      );
    }

    // Validate enabled providers
    if (featureFlags.stripeEnabled) {
      validateStripeConfig(serverSide);
    }
    if (featureFlags.paypalEnabled) {
      validatePayPalConfig(serverSide);
    }

    // Validate email config on server-side
    if (serverSide) {
      validateEmailConfig();
    }

    logger.info('Payment config validated', {
      enabledProviders: enabledProviders.join(', '),
    });
  } catch (error) {
    logger.error('Payment configuration error', { error });
    throw error;
  }
}
