// Security Hardening: Rate Limiting Unit Tests
// Feature 017 - Task T009 (Refactored for proper unit testing)
// Purpose: Test rate limiting business logic without database dependency

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  formatLockoutTime,
  recordFailedAttempt,
  resetSupabaseClient,
  setSupabaseClient,
} from '../rate-limit-check';

describe('Rate Limiting - Unit Tests', () => {
  describe('formatLockoutTime', () => {
    it('should format time remaining correctly', () => {
      const oneMinute = new Date(Date.now() + 60 * 1000).toISOString();
      expect(formatLockoutTime(oneMinute)).toBe('1 minute');

      const fiveMinutes = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      expect(formatLockoutTime(fiveMinutes)).toBe('5 minutes');

      const fifteenMinutes = new Date(
        Date.now() + 15 * 60 * 1000
      ).toISOString();
      expect(formatLockoutTime(fifteenMinutes)).toBe('15 minutes');
    });

    it('should return "shortly" for expired locks', () => {
      const pastTime = new Date(Date.now() - 1000).toISOString();
      expect(formatLockoutTime(pastTime)).toBe('shortly');
    });

    it('should handle fractional minutes correctly', () => {
      const thirtySeconds = new Date(Date.now() + 30 * 1000).toISOString();
      expect(formatLockoutTime(thirtySeconds)).toBe('1 minute'); // Rounds up

      const ninetySeconds = new Date(Date.now() + 90 * 1000).toISOString();
      expect(formatLockoutTime(ninetySeconds)).toBe('2 minutes'); // Rounds up
    });
  });

  /**
   * THE RPC PAYLOAD IS THE CONTRACT, AND NOTHING WAS ASSERTING IT (#839).
   *
   * `checkRateLimit` and `recordFailedAttempt` are the two functions that carry the
   * security behaviour in this module, and they had ZERO unit coverage — the file sat
   * at 23.5% statements and 20% functions because only `formatLockoutTime` above was
   * tested. So the `ipAddress` parameter, and the `p_ip_address` key it put in every
   * RPC call, could be added or removed with nothing to notice either way. #839
   * removes them; this is the test that should have been written first.
   *
   * No module mocking. `setSupabaseClient()` exists for exactly this
   * (rate-limit-check.ts:11-19) and was previously used only by an integration test
   * that points at the production project. A hand-rolled fake keeps these offline.
   */
  const rpcCalls: { fn: string; params: Record<string, unknown> }[] = [];

  /**
   * @param impl what `.rpc()` resolves to, or a function that throws to exercise the
   *             `catch` path — which is a DIFFERENT branch from an `error` in the
   *             resolved value, and both must fail closed.
   */
  function injectClient(impl: () => unknown): void {
    setSupabaseClient({
      rpc: vi.fn(async (fn: string, params: Record<string, unknown>) => {
        rpcCalls.push({ fn, params });
        return impl();
      }),
    } as unknown as SupabaseClient);
  }

  beforeEach(() => {
    rpcCalls.length = 0;
    // The module logs every failure through `logger.error`, which reaches the console
    // at test level. Silenced so the error-path cases below do not look like failures
    // in the run output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // `supabaseClient` is a module-level singleton: without this the fake leaks into
    // every suite that loads this module afterwards.
    resetSupabaseClient();
    vi.restoreAllMocks();
  });

  describe('checkRateLimit', () => {
    it('sends the identifier and attempt type, and NOTHING else (#839)', async () => {
      injectClient(() => ({
        data: { allowed: true, remaining: 4, locked_until: null },
        error: null,
      }));

      await checkRateLimit('user@example.com', 'sign_in');

      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].fn).toBe('check_rate_limit');
      // Exact-match on purpose: a re-added `p_ip_address` fails here. `toEqual` on the
      // whole object is what makes this a contract rather than a spot check.
      expect(rpcCalls[0].params).toEqual({
        p_identifier: 'user@example.com',
        p_attempt_type: 'sign_in',
      });
    });

    it('returns what the RPC said when the attempt is allowed', async () => {
      const payload = { allowed: true, remaining: 3, locked_until: null };
      injectClient(() => ({ data: payload, error: null }));

      await expect(
        checkRateLimit('user@example.com', 'sign_up')
      ).resolves.toEqual(payload);
    });

    it('passes a lockout through rather than second-guessing it', async () => {
      const locked = {
        allowed: false,
        remaining: 0,
        locked_until: '2026-01-01T00:00:00.000Z',
      };
      injectClient(() => ({ data: locked, error: null }));

      await expect(
        checkRateLimit('user@example.com', 'sign_in')
      ).resolves.toEqual(locked);
    });

    it('FAILS CLOSED when the RPC returns an error', async () => {
      // The whole point of the function. If rate limiting is down, an attempt must be
      // blocked rather than waved through — otherwise the outage IS the brute-force
      // window.
      injectClient(() => ({ data: null, error: { message: 'rpc exploded' } }));

      const result = await checkRateLimit('user@example.com', 'sign_in');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.locked_until).toBeNull();
      expect(result.reason).toMatch(/unavailable/i);
    });

    it('FAILS CLOSED when the RPC throws', async () => {
      // A thrown call is a separate branch from a returned `error`, and a fix to one
      // has twice been mistaken for a fix to both.
      injectClient(() => {
        throw new Error('network unreachable');
      });

      const result = await checkRateLimit('user@example.com', 'password_reset');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toMatch(/unavailable/i);
    });
  });

  describe('recordFailedAttempt', () => {
    it('sends the identifier and attempt type, and NOTHING else (#839)', async () => {
      injectClient(() => ({ error: null }));

      await recordFailedAttempt('user@example.com', 'sign_in');

      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].fn).toBe('record_failed_attempt');
      expect(rpcCalls[0].params).toEqual({
        p_identifier: 'user@example.com',
        p_attempt_type: 'sign_in',
      });
    });

    it('never throws when the RPC returns an error', async () => {
      // Every caller — SignInForm, SignUpForm, ForgotPasswordForm — invokes this from
      // inside its own catch block while handling a failed login. Throwing here would
      // replace the user's real error with a bookkeeping one.
      injectClient(() => ({ error: { message: 'insert failed' } }));

      await expect(
        recordFailedAttempt('user@example.com', 'sign_in')
      ).resolves.toBeUndefined();
    });

    it('never throws when the RPC itself throws', async () => {
      injectClient(() => {
        throw new Error('network unreachable');
      });

      await expect(
        recordFailedAttempt('user@example.com', 'sign_up')
      ).resolves.toBeUndefined();
    });
  });
});
