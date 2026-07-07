/**
 * Error categorization tests — pure mapping logic, no I/O.
 * FR-001 (clear messages), FR-002 (categorization), FR-003 (resolution
 * suggestions), NFR-001 (non-technical, actionable).
 */

import { describe, it, expect } from 'vitest';
import {
  categorizePaymentError,
  type PaymentErrorCategory,
} from '../error-categorization';

describe('categorizePaymentError', () => {
  describe('Stripe error codes', () => {
    it.each<[string, PaymentErrorCategory, boolean]>([
      ['card_declined', 'card_declined', true],
      ['generic_decline', 'card_declined', true],
      ['insufficient_funds', 'insufficient_funds', true],
      ['expired_card', 'expired_card', false],
      ['incorrect_cvc', 'invalid_card', true],
      ['invalid_cvc', 'invalid_card', true],
      ['invalid_number', 'invalid_card', true],
      ['invalid_expiry_month', 'invalid_card', true],
      ['invalid_expiry_year', 'invalid_card', true],
      ['processing_error', 'processing_error', true],
      ['authentication_required', 'authentication_required', true],
      ['card_not_supported', 'card_declined', true],
      ['currency_not_supported', 'limit_exceeded', false],
      ['amount_too_large', 'limit_exceeded', false],
      ['amount_too_small', 'limit_exceeded', false],
    ])(
      'maps Stripe code %s to category %s (recoverable=%s)',
      (code, expectedCategory, expectedRecoverable) => {
        const result = categorizePaymentError(code, null);
        expect(result.category).toBe(expectedCategory);
        expect(result.recoverable).toBe(expectedRecoverable);
        expect(result.userMessage.length).toBeGreaterThan(0);
        expect(result.resolutionHint.length).toBeGreaterThan(0);
      }
    );
  });

  describe('PayPal error codes', () => {
    it.each<[string, PaymentErrorCategory, boolean]>([
      ['INSTRUMENT_DECLINED', 'card_declined', true],
      ['PAYER_ACTION_REQUIRED', 'authentication_required', true],
      ['INSUFFICIENT_FUNDS', 'insufficient_funds', true],
      ['CARD_EXPIRED', 'expired_card', false],
      ['INVALID_CARD_NUMBER', 'invalid_card', true],
      ['TRANSACTION_REFUSED', 'card_declined', true],
      ['TRANSACTION_LIMIT_EXCEEDED', 'limit_exceeded', false],
    ])(
      'maps PayPal code %s to category %s (recoverable=%s)',
      (code, expectedCategory, expectedRecoverable) => {
        const result = categorizePaymentError(code, null);
        expect(result.category).toBe(expectedCategory);
        expect(result.recoverable).toBe(expectedRecoverable);
      }
    );
  });

  describe('unknown / null inputs', () => {
    it('maps null code to unknown', () => {
      const result = categorizePaymentError(null, null);
      expect(result.category).toBe('unknown');
      // Unknown failures get a conservative recoverable=true so the user
      // can attempt a retry; the retry-cap and cooling-period guard against
      // abuse anyway. (FR-006 — retry available for "recoverable failures",
      // and we can't tell what we don't recognize.)
      expect(result.recoverable).toBe(true);
      expect(result.userMessage).toMatch(/payment.*could not be completed/i);
    });

    it('maps unrecognized code to unknown', () => {
      const result = categorizePaymentError('some_future_provider_code', null);
      expect(result.category).toBe('unknown');
      expect(result.recoverable).toBe(true);
    });

    it('does not leak the raw error_message into userMessage', () => {
      // NFR-001: error messages MUST be non-technical. Provider messages
      // can include internal IDs, stack traces, "PG: 23505", etc.
      const result = categorizePaymentError(
        null,
        'PG ERROR 23505 duplicate key violates uniq_xyz on (template_user_id)'
      );
      expect(result.userMessage).not.toContain('PG ERROR');
      expect(result.userMessage).not.toContain('23505');
    });
  });

  describe('category-level invariants (NFR-001)', () => {
    it('every userMessage is short enough to read at a glance (< 200 chars)', () => {
      const codes = [
        'card_declined',
        'insufficient_funds',
        'expired_card',
        'incorrect_cvc',
        'processing_error',
        'authentication_required',
        'amount_too_large',
        null,
      ];
      for (const code of codes) {
        const result = categorizePaymentError(code, null);
        expect(result.userMessage.length).toBeLessThan(200);
        expect(result.resolutionHint.length).toBeLessThan(200);
      }
    });

    it('every userMessage avoids technical terms', () => {
      const codes = [
        'card_declined',
        'insufficient_funds',
        'expired_card',
        'incorrect_cvc',
        'processing_error',
        'authentication_required',
        'amount_too_large',
        null,
      ];
      const technicalTerms = [
        /\bnull\b/i,
        /\bundefined\b/i,
        /\bAPI\b/,
        /\bUUID\b/i,
        /\bHTTP\b/,
        /\bresponse code\b/i,
      ];
      for (const code of codes) {
        const result = categorizePaymentError(code, null);
        for (const re of technicalTerms) {
          expect(result.userMessage).not.toMatch(re);
        }
      }
    });
  });
});
