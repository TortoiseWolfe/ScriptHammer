/**
 * Payment Error Categorization (FR-002)
 *
 * Maps provider-specific error codes from `payment_results.error_code`
 * to one of 8 user-facing categories with non-technical messages and
 * resolution hints (FR-001, FR-003, NFR-001).
 *
 * Pure mapping, no I/O. The `recoverable` flag gates the retry button
 * (FR-006): non-recoverable failures hide retry and show support contact
 * instead of letting the user burn through retry attempts that can't help.
 */

export type PaymentErrorCategory =
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'invalid_card'
  | 'processing_error'
  | 'network_error'
  | 'authentication_required'
  | 'limit_exceeded'
  | 'unknown';

export interface CategorizedError {
  category: PaymentErrorCategory;
  userMessage: string;
  recoverable: boolean;
  resolutionHint: string;
}

/**
 * Lookup table: provider code (lowercased for case-insensitive match)
 * → category. Stripe codes are snake_case; PayPal codes are SCREAMING_CASE.
 * Extend by adding entries here.
 */
const CODE_TO_CATEGORY: Record<string, PaymentErrorCategory> = {
  // ── Stripe ────────────────────────────────────────────────────────────
  card_declined: 'card_declined',
  generic_decline: 'card_declined',
  card_not_supported: 'card_declined',
  insufficient_funds: 'insufficient_funds',
  expired_card: 'expired_card',
  incorrect_cvc: 'invalid_card',
  invalid_cvc: 'invalid_card',
  invalid_number: 'invalid_card',
  invalid_expiry_month: 'invalid_card',
  invalid_expiry_year: 'invalid_card',
  processing_error: 'processing_error',
  authentication_required: 'authentication_required',
  amount_too_large: 'limit_exceeded',
  amount_too_small: 'limit_exceeded',
  currency_not_supported: 'limit_exceeded',

  // ── PayPal ────────────────────────────────────────────────────────────
  instrument_declined: 'card_declined',
  payer_action_required: 'authentication_required',
  card_expired: 'expired_card',
  invalid_card_number: 'invalid_card',
  transaction_refused: 'card_declined',
  transaction_limit_exceeded: 'limit_exceeded',
};

/**
 * Categories where retry can plausibly help. Categories listed as
 * non-recoverable (`expired_card`, `limit_exceeded`, `currency_not_supported`)
 * require user action that retry alone cannot accomplish — show support
 * contact instead.
 */
const RECOVERABLE_CATEGORIES: Record<PaymentErrorCategory, boolean> = {
  card_declined: true, // transient bank-side decisions can flip
  insufficient_funds: true, // user may add funds and retry
  invalid_card: true, // typo correction is a retry
  processing_error: true, // provider-side hiccup
  network_error: true,
  authentication_required: true, // 3DS prompt may now be acked
  unknown: true, // conservative — let cap + cooling guard
  expired_card: false, // requires new card, not retry
  limit_exceeded: false, // requires different amount/method
};

const COPY: Record<
  PaymentErrorCategory,
  { userMessage: string; resolutionHint: string }
> = {
  card_declined: {
    userMessage: 'Your card was declined.',
    resolutionHint:
      'Please contact your card issuer or try a different payment method.',
  },
  insufficient_funds: {
    userMessage: 'Your card does not have enough funds for this purchase.',
    resolutionHint:
      'Please add funds to your account or try a different payment method.',
  },
  expired_card: {
    userMessage: 'Your card has expired.',
    resolutionHint:
      'Please use a different payment method with a current expiry date.',
  },
  invalid_card: {
    userMessage: 'The card details look incorrect.',
    resolutionHint:
      'Please check the card number, expiry, and security code, then try again.',
  },
  processing_error: {
    userMessage:
      'We could not process your payment right now. This is usually temporary.',
    resolutionHint:
      'Please wait a moment and try again. If the problem persists, contact support.',
  },
  network_error: {
    userMessage: 'A network problem interrupted your payment.',
    resolutionHint:
      'Please check your connection and try again. Your payment was not charged.',
  },
  authentication_required: {
    userMessage: 'Your bank needs to verify this payment.',
    resolutionHint:
      'Please complete the verification step shown by your bank, then try again.',
  },
  limit_exceeded: {
    userMessage: 'This amount is outside the limits for your payment method.',
    resolutionHint:
      'Please try a smaller amount or use a different payment method.',
  },
  unknown: {
    userMessage: 'Your payment could not be completed.',
    resolutionHint:
      'Please try again. If the problem persists, contact support with the transaction reference.',
  },
};

/**
 * Categorize a payment error.
 *
 * @param errorCode - Provider's error code, e.g. Stripe `card_declined`
 *                    or PayPal `INSTRUMENT_DECLINED`. May be null.
 * @param _errorMessage - Provider's raw error message. Currently unused —
 *                         we never surface raw provider text to users
 *                         (NFR-001) — but the parameter is kept so callers
 *                         have a stable API if richer mapping is added later.
 */
export function categorizePaymentError(
  errorCode: string | null,
  _errorMessage: string | null
): CategorizedError {
  const key = errorCode?.toLowerCase() ?? null;
  const category: PaymentErrorCategory =
    (key && CODE_TO_CATEGORY[key]) || 'unknown';
  const copy = COPY[category];
  return {
    category,
    userMessage: copy.userMessage,
    resolutionHint: copy.resolutionHint,
    recoverable: RECOVERABLE_CATEGORIES[category],
  };
}
