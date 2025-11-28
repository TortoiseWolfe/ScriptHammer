/**
 * Security Test: RLS Policies - T062
 * Tests Row Level Security policies prevent unauthorized access
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Note: These tests require Supabase credentials
// In CI/CD, use test database with known test users

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

test.describe('Row Level Security Policies', () => {
  test('should prevent anonymous users from writing to payment_intents', async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Try to insert payment intent as anonymous user
    const { data, error } = await supabase.from('payment_intents').insert({
      amount: 1000,
      currency: 'usd',
      type: 'one_time',
      customer_email: 'test@example.com',
    });

    // Should be blocked by RLS
    expect(error).toBeTruthy();
    expect(error?.message).toContain('new row violates row-level security');
    expect(data).toBeNull();
  });

  test('should prevent users from reading other users payment results', async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Try to query all payment results
    const { data, error } = await supabase.from('payment_results').select('*');

    // Should either:
    // 1. Return error (if RLS denies SELECT)
    // 2. Return empty array (if RLS filters rows)
    // 3. Return only current user's data

    if (error) {
      expect(error.message).toContain('row-level security');
    } else {
      // If no error, verify we only get current user's data
      // (In production, this would be tested with actual authenticated users)
      expect(data).toEqual([]);
    }
  });

  test('should prevent modification of webhook_events table', async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Try to insert webhook event (should only be allowed from service role)
    const { data, error } = await supabase.from('webhook_events').insert({
      provider: 'stripe',
      event_id: 'evt_test',
      event_type: 'payment_intent.succeeded',
      payload: {},
      signature: 'test_sig',
      signature_verified: true,
      processing_status: 'pending',
    });

    // Should be blocked
    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });

  test('should prevent users from deleting payment_results', async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Try to delete a payment result
    const { data, error } = await supabase
      .from('payment_results')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');

    // Should be blocked
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(
      /violates row-level security|permission denied/
    );
  });

  test('should allow service role to write payment data', async () => {
    // This test would use service role key
    // Skip if not in test environment

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
      return;
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Service role should be able to insert
    const { data, error } = await supabaseAdmin
      .from('payment_intents')
      .insert({
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'test@example.com',
        template_user_id: '00000000-0000-0000-0000-000000000000',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.amount).toBe(1000);

    // Clean up
    await supabaseAdmin.from('payment_intents').delete().eq('id', data.id);
  });

  test('should enforce currency validation in database constraints', async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
      return;
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Try to insert invalid currency
    const { data, error } = await supabaseAdmin
      .from('payment_intents')
      .insert({
        amount: 1000,
        currency: 'INVALID' as never, // Not in allowed currencies
        type: 'one_time',
        customer_email: 'test@example.com',
        template_user_id: '00000000-0000-0000-0000-000000000000',
      })
      .select();

    // Should be blocked by CHECK constraint (if implemented)
    // Or should be validated in application layer
    expect(
      error || (data && data.length > 0 && data[0].currency === 'usd')
    ).toBeTruthy();
  });

  test('should prevent SQL injection in payment queries', async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Try SQL injection in email field
    const maliciousEmail = "'; DROP TABLE payment_intents; --";

    const { error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('customer_email', maliciousEmail);

    // Should safely escape and return no results or error
    expect(error?.message).not.toContain('syntax error');
  });

  test('should rate limit payment creation attempts', async ({ page }) => {
    // This tests application-level rate limiting

    await page.goto('/payment-demo');

    // Grant consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
    }

    // Try to create many payments rapidly
    await page.getByRole('tab', { name: /stripe/i }).click();

    for (let i = 0; i < 20; i++) {
      await page.getByRole('button', { name: /pay/i }).click();
      await page.waitForTimeout(100);
    }

    // Should show rate limit warning after some attempts
    await expect(
      page.getByRole('alert', { name: /too many.*requests|rate.*limit/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('should validate payment amount constraints', async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
      return;
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Try to insert negative amount
    const { error: negativeError } = await supabaseAdmin
      .from('payment_intents')
      .insert({
        amount: -1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'test@example.com',
        template_user_id: '00000000-0000-0000-0000-000000000000',
      });

    // Should be blocked by CHECK constraint
    expect(negativeError).toBeTruthy();
    expect(negativeError?.message).toContain('violates check constraint');

    // Try to insert zero amount
    const { error: zeroError } = await supabaseAdmin
      .from('payment_intents')
      .insert({
        amount: 0,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'test@example.com',
        template_user_id: '00000000-0000-0000-0000-000000000000',
      });

    // Should also be blocked
    expect(zeroError).toBeTruthy();
  });

  test('should prevent users from bypassing webhook verification', async ({
    page,
  }) => {
    await page.goto('/payment-demo');

    // Grant consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
    }

    // Initiate payment
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Wait for redirect
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

    // Try to manually set webhook_verified to true via client
    const result = await page.evaluate(async () => {
      try {
        // This should fail due to RLS
        const response = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: 'test', verified: true }),
        });
        return response.status;
      } catch (e) {
        return 0;
      }
    });

    // Should return 403 Forbidden or 401 Unauthorized
    expect([0, 401, 403]).toContain(result);
  });
});
