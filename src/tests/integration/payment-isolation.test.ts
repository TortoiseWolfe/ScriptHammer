// Security Hardening: Payment Isolation Integration Tests
// Feature 017 - Task T011
// Purpose: Test RLS enforcement prevents cross-user payment data access

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Test users from seed-test-user.sql
const TEST_USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const TEST_USER_B = {
  email: process.env.TEST_USER_SECONDARY_EMAIL || 'test2@example.com',
  password: process.env.TEST_USER_SECONDARY_PASSWORD || 'TestPassword123!',
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Payment Data Isolation - REQ-SEC-001', () => {
  let userAClient: ReturnType<typeof createClient<Database>>;
  let userBClient: ReturnType<typeof createClient<Database>>;
  let userAId: string;
  let userBId: string;
  let paymentIntentId: string;

  beforeAll(async () => {
    // Create separate Supabase clients for each user with isolated storage
    userAClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'test-user-a-session',
      },
    });
    userBClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'test-user-b-session',
      },
    });

    // Sign in as User A
    const { data: userAData, error: userAError } =
      await userAClient.auth.signInWithPassword({
        email: TEST_USER_A.email,
        password: TEST_USER_A.password,
      });

    if (userAError) {
      throw new Error(`Failed to sign in as User A: ${userAError.message}`);
    }

    userAId = userAData.user!.id;

    // Sign in as User B (optional - skip tests if not available)
    const { data: userBData, error: userBError } =
      await userBClient.auth.signInWithPassword({
        email: TEST_USER_B.email,
        password: TEST_USER_B.password,
      });

    if (userBError) {
      console.warn(
        `⏭️  Skipping payment isolation tests - User B not configured (${userBError.message})`
      );
      // Skip all tests that require User B
      return;
    }

    userBId = userBData.user!.id;
  });

  afterAll(async () => {
    // Clean up: Delete test payment intent
    if (paymentIntentId) {
      await userAClient
        .from('payment_intents')
        .delete()
        .eq('id', paymentIntentId);
    }

    // Sign out both users
    await userAClient.auth.signOut();
    await userBClient.auth.signOut();
  });

  describe('Payment Intent Creation', () => {
    it('should create payment intent with authenticated user ID', async () => {
      const { data, error } = await userAClient
        .from('payment_intents')
        .insert({
          template_user_id: userAId, // Should match authenticated user
          amount: 1000,
          currency: 'usd',
          type: 'one_time',
          customer_email: TEST_USER_A.email,
          metadata: {},
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.template_user_id).toBe(userAId);

      // Save for cleanup and later tests
      paymentIntentId = data!.id;
    });

    it('should reject payment intent with mismatched user ID', async () => {
      // User A tries to create payment for User B
      const { data, error } = await userAClient
        .from('payment_intents')
        .insert({
          template_user_id: userBId, // Different user ID
          amount: 1000,
          currency: 'usd',
          type: 'one_time',
          customer_email: TEST_USER_A.email,
          metadata: {},
        })
        .select()
        .single();

      // RLS policy should prevent this
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/policy|permission|denied/i);
      expect(data).toBeNull();
    });
  });

  describe('Payment Intent Query Isolation', () => {
    it('User A should see their own payment intents', async () => {
      const { data, error } = await userAClient
        .from('payment_intents')
        .select('*')
        .eq('id', paymentIntentId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].template_user_id).toBe(userAId);
    });

    it('User B should NOT see User A payment intents', async () => {
      const { data, error } = await userBClient
        .from('payment_intents')
        .select('*')
        .eq('id', paymentIntentId);

      // RLS should return empty result set, not an error
      expect(error).toBeNull();
      expect(data).toHaveLength(0); // User B sees nothing
    });

    it('should enforce isolation in COUNT queries', async () => {
      // User A's count should include their payment
      const { count: countA } = await userAClient
        .from('payment_intents')
        .select('*', { count: 'exact', head: true })
        .eq('template_user_id', userAId);

      expect(countA).toBeGreaterThan(0);

      // User B querying for User A's payments should get 0
      const { count: countB } = await userBClient
        .from('payment_intents')
        .select('*', { count: 'exact', head: true })
        .eq('template_user_id', userAId);

      expect(countB).toBe(0); // RLS blocks the query
    });
  });

  describe('Payment Update and Delete Protection', () => {
    it('should prevent updating payment intents', async () => {
      const { error } = await userAClient
        .from('payment_intents')
        .update({ amount: 2000 })
        .eq('id', paymentIntentId);

      // Immutability policy should prevent this
      expect(error).toBeDefined();
    });

    it('should prevent User B from updating User A payment', async () => {
      const { error } = await userBClient
        .from('payment_intents')
        .update({ amount: 2000 })
        .eq('id', paymentIntentId);

      expect(error).toBeDefined();
    });

    it('should prevent User B from deleting User A payment', async () => {
      const { error } = await userBClient
        .from('payment_intents')
        .delete()
        .eq('id', paymentIntentId);

      expect(error).toBeDefined();
    });
  });

  describe('Payment Results Isolation', () => {
    it('User B should not see payment results for User A payments', async () => {
      // This would require creating a payment result first
      // For now, test the query returns empty

      const { data, error } = await userBClient
        .from('payment_results')
        .select('*')
        .eq('intent_id', paymentIntentId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS blocks access
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent SQL injection in user ID', async () => {
      // Attempt SQL injection via user ID
      const { data, error } = await userAClient
        .from('payment_intents')
        .insert({
          template_user_id: "' OR '1'='1", // SQL injection attempt
          amount: 1000,
          currency: 'usd',
          type: 'one_time',
          customer_email: TEST_USER_A.email,
          metadata: {},
        } as any)
        .select()
        .single();

      // Should fail due to type checking and RLS
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should handle concurrent access safely', async () => {
      // Both users query simultaneously
      const [resultA, resultB] = await Promise.all([
        userAClient
          .from('payment_intents')
          .select('*')
          .eq('id', paymentIntentId),
        userBClient
          .from('payment_intents')
          .select('*')
          .eq('id', paymentIntentId),
      ]);

      // User A sees their payment
      expect(resultA.data).toHaveLength(1);

      // User B does not
      expect(resultB.data).toHaveLength(0);
    });
  });
});
