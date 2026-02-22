/**
 * Admin Access Contract Tests
 * Verifies that non-admin users cannot access admin RPC functions
 */
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Admin Access Contract Tests', () => {
  it('non-admin gets empty result from admin_payment_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_payment_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_auth_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_auth_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_user_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_user_stats');
    expect(data).toEqual({});
  });

  it('non-admin gets empty result from admin_messaging_stats', async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
    });
    const { data } = await supabase.rpc('admin_messaging_stats');
    expect(data).toEqual({});
  });
});
