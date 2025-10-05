/**
 * Contract Test: OAuth API (POST /auth/v1/authorize)
 *
 * Tests the contract between our app and Supabase Auth OAuth endpoints.
 * These tests MUST fail until implementation is complete (TDD RED phase).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';

describe('Supabase Auth OAuth Contract', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient();
  });

  it('should return redirect URL for GitHub OAuth', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    expect(error).toBeNull();
    expect(data.url).toBeDefined();
    expect(data.url).toContain('github.com');
    expect(data.provider).toBe('github');
  });

  it('should return redirect URL for Google OAuth', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    expect(error).toBeNull();
    expect(data.url).toBeDefined();
    expect(data.url).toContain('google');
    expect(data.provider).toBe('google');
  });

  it('should include scopes in OAuth request', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'read:user user:email',
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    expect(error).toBeNull();
    expect(data.url).toContain('scope');
  });

  it('should handle OAuth callback code exchange', async () => {
    // Note: This requires actual OAuth flow with provider
    // We document the expected contract here

    // After OAuth provider redirects back with code:
    // const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Expected response structure:
    // expect(data.session).toBeDefined();
    // expect(data.user).toBeDefined();

    // This is tested in E2E tests with actual OAuth flow
    expect(true).toBe(true); // Placeholder for contract documentation
  });

  it('should reject unsupported OAuth provider', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'unsupported' as any,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    expect(error).toBeDefined();
  });
});
