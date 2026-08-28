// Security Hardening: Rate Limiting Integration Tests
// Feature 017 - Task T009 (Integration Tests with Real Database)
// Purpose: Test rate limiting with actual database to verify SQL logic

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import {
  checkRateLimit,
  recordFailedAttempt,
  setSupabaseClient,
  resetSupabaseClient,
} from '@/lib/auth/rate-limit-check';
import { supabaseAdmin } from '@tests/supabase-admin';

/**
 * Integration Tests for Rate Limiting
 *
 * These tests require a real Supabase database connection.
 * They verify that the PostgreSQL functions work correctly.
 *
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * - Database migrations applied
 * - rate_limit_attempts table exists
 * - check_rate_limit() and record_failed_attempt() functions exist
 */

describe('Rate Limiting - Integration Tests (Real Database)', () => {
  const testEmail = `test-${Date.now()}@example.com`; // Unique per test run

  // Use real Supabase client for integration tests
  beforeAll(() => {
    setSupabaseClient(supabaseAdmin);
  });

  afterAll(() => {
    resetSupabaseClient();
  });

  beforeEach(async () => {
    // Clean up any existing data for this test email
    await supabaseAdmin
      .from('rate_limit_attempts')
      .delete()
      .eq('identifier', testEmail);

    // Wait for cleanup to complete
    await new Promise((r) => setTimeout(r, 100));
  });

  afterEach(async () => {
    // Cleanup after each test
    await supabaseAdmin
      .from('rate_limit_attempts')
      .delete()
      .eq('identifier', testEmail);
  });

  describe('Server-Side Rate Limiting Logic', () => {
    it('should allow attempts when under the limit', async () => {
      const result = await checkRateLimit(testEmail, 'sign_in');

      expect(result).toEqual({
        allowed: true,
        remaining: 5,
        locked_until: null,
      });
    });

    it('should decrement remaining attempts after failed attempt', async () => {
      // First check - should have 5 remaining
      const before = await checkRateLimit(testEmail, 'sign_in');
      expect(before.remaining).toBe(5);

      // Record failure
      await recordFailedAttempt(testEmail, 'sign_in');

      // Wait for database write
      await new Promise((r) => setTimeout(r, 100));

      // Second check - should have 4 remaining
      const after = await checkRateLimit(testEmail, 'sign_in');
      expect(after.remaining).toBe(4);
    });

    it('should block attempts after 5 failures', async () => {
      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(testEmail, 'sign_in');
        await recordFailedAttempt(testEmail, 'sign_in');
        await new Promise((r) => setTimeout(r, 50));
      }

      // 6th attempt should be blocked
      const result = await checkRateLimit(testEmail, 'sign_in');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.locked_until).toBeTruthy();
      expect(result.reason).toBe('rate_limited');
    });

    it('should track different attempt types independently', async () => {
      // Fail 3 sign_in attempts
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(testEmail, 'sign_in');
        await recordFailedAttempt(testEmail, 'sign_in');
      }

      await new Promise((r) => setTimeout(r, 100));

      // sign_up should still have 5 remaining
      const signUpResult = await checkRateLimit(testEmail, 'sign_up');
      expect(signUpResult.remaining).toBe(5);

      // sign_in should have 2 remaining
      const signInResult = await checkRateLimit(testEmail, 'sign_in');
      expect(signInResult.remaining).toBe(2);
    });

    it('should return lockout time approximately 15 minutes in future', async () => {
      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(testEmail, 'sign_in');
        await recordFailedAttempt(testEmail, 'sign_in');
      }

      await new Promise((r) => setTimeout(r, 100));

      const result = await checkRateLimit(testEmail, 'sign_in');

      expect(result.locked_until).toBeTruthy();

      const lockedUntil = new Date(result.locked_until!);
      const now = new Date();
      const minutesUntilUnlock =
        (lockedUntil.getTime() - now.getTime()) / (1000 * 60);

      // Should be locked for approximately 15 minutes
      expect(minutesUntilUnlock).toBeGreaterThan(14);
      expect(minutesUntilUnlock).toBeLessThan(16);
    });
  });

  describe('Database Isolation', () => {
    it('should track different identifiers independently', async () => {
      const email1 = `user1-${Date.now()}@example.com`;
      const email2 = `user2-${Date.now()}@example.com`;

      try {
        // Fail 5 attempts for user1
        for (let i = 0; i < 5; i++) {
          await checkRateLimit(email1, 'sign_in');
          await recordFailedAttempt(email1, 'sign_in');
        }

        await new Promise((r) => setTimeout(r, 100));

        // User1 should be blocked
        const result1 = await checkRateLimit(email1, 'sign_in');
        expect(result1.allowed).toBe(false);

        // User2 should still be allowed
        const result2 = await checkRateLimit(email2, 'sign_in');
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(5);
      } finally {
        // Cleanup
        await supabaseAdmin
          .from('rate_limit_attempts')
          .delete()
          .eq('identifier', email1);
        await supabaseAdmin
          .from('rate_limit_attempts')
          .delete()
          .eq('identifier', email2);
      }
    });
  });

  describe('Data Integrity', () => {
    // #839 INVERTED THIS ASSERTION, and the inversion is the point.
    //
    // It used to pass a fixture IP and assert the column came back equal to it.
    // That passed here and described nothing real: no production caller ever
    // supplied an IP, so the column was always NULL in the live table — 7440 rows
    // of it — and the admin burst-detection CTE, which filtered
    // `WHERE ip_address IS NOT NULL`, could never return a row. The test proved
    // the plumbing worked when a test supplied the argument, which is the one
    // condition that never occurred outside this file.
    //
    // The column and the SQL parameter both survive (`p_ip_address INET DEFAULT
    // NULL`), so restoring the plumbing is a one-line change in
    // rate-limit-check.ts. Asserting NULL is what makes that change visible: put
    // the address back without restoring a consumer for it and this fails,
    // instead of quietly re-creating a column nothing reads.
    it('records no IP address — the client no longer sends one (#839)', async () => {
      await recordFailedAttempt(testEmail, 'sign_in');

      await new Promise((r) => setTimeout(r, 100));

      const { data } = await supabaseAdmin
        .from('rate_limit_attempts')
        .select('*')
        .eq('identifier', testEmail)
        .single();

      // The row must exist — otherwise this passes by recording nothing at all.
      expect(data).toBeTruthy();
      expect(data?.ip_address).toBeNull();
    });

    it('should store attempt type correctly', async () => {
      await recordFailedAttempt(testEmail, 'password_reset');

      await new Promise((r) => setTimeout(r, 100));

      const { data } = await supabaseAdmin
        .from('rate_limit_attempts')
        .select('*')
        .eq('identifier', testEmail)
        .single();

      expect(data?.attempt_type).toBe('password_reset');
    });
  });
});
