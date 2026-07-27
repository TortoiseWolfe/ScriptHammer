import { describe, it, expect } from 'vitest';
import { isTransientAdminError } from '../e2e/utils/transient-admin-error';

/**
 * #345 — the predicate that decides whether an E2E prerequisite failure reds a
 * shard or gets another attempt.
 *
 * Both directions are asserted deliberately. A retry predicate that returns
 * `true` too readily silently converts real misconfiguration into a slow pass;
 * one that returns `false` too readily reds `main` for a network blip and
 * teaches people to re-run without reading. Testing only the happy direction
 * would leave the expensive half unverified.
 */
describe('isTransientAdminError (#345)', () => {
  describe('retries — the failure carries no explanation', () => {
    it('treats an empty message as transient (the reported `{}` signature)', () => {
      expect(isTransientAdminError({ message: '' })).toBe(true);
    });

    it('treats a whitespace-only message as transient', () => {
      expect(isTransientAdminError({ message: '   ' })).toBe(true);
    });

    it('treats a literal "{}" message as transient', () => {
      expect(isTransientAdminError({ message: '{}' })).toBe(true);
    });

    it('treats an error object with no message field as transient', () => {
      expect(isTransientAdminError({})).toBe(true);
    });
  });

  describe('retries — named network and gateway conditions', () => {
    it.each([
      'fetch failed',
      'network error',
      'request timed out',
      'Timeout while connecting',
      'socket hang up',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN supabase.co',
      '502 Bad Gateway',
      '503 Service Unavailable',
      'upstream connect error',
    ])('retries %j', (message) => {
      expect(isTransientAdminError({ message })).toBe(true);
    });

    it('retries any 5xx status, even when the message is unhelpful', () => {
      expect(
        isTransientAdminError({ message: 'Server Error', status: 500 })
      ).toBe(true);
      expect(isTransientAdminError({ message: 'oops', status: 599 })).toBe(
        true
      );
    });
  });

  describe('does NOT retry — a genuine, named refusal', () => {
    it('fails fast on wrong credentials', () => {
      // The single most important case: retrying this would turn a wrong
      // TEST_USER_PRIMARY_PASSWORD into a slow failure with a confusing
      // message, instead of the clear one the prereq check is there to give.
      expect(
        isTransientAdminError({ message: 'Invalid login credentials' })
      ).toBe(false);
    });

    it.each([
      'User not allowed',
      'not authorized',
      'JWT expired',
      'Email not confirmed',
      'captcha protection: request disallowed (no captcha_token found)',
    ])('fails fast on %j', (message) => {
      expect(isTransientAdminError({ message })).toBe(false);
    });

    it('does not retry a 4xx', () => {
      expect(
        isTransientAdminError({ message: 'Bad Request', status: 400 })
      ).toBe(false);
      expect(
        isTransientAdminError({ message: 'Unauthorized', status: 401 })
      ).toBe(false);
    });
  });

  describe('absence of an error is not a transient', () => {
    it.each([null, undefined])('returns false for %s', (value) => {
      expect(isTransientAdminError(value)).toBe(false);
    });
  });
});
