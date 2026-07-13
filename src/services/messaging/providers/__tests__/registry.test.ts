/**
 * Unit tests for the messaging provider registry (#266).
 *
 * Proves the env-var switch (NEXT_PUBLIC_BACKEND_PROVIDER) selects the right
 * provider and the DI override seam works. No live backend needed — this is the
 * selection logic, not the data round-trips (those live in the conformance
 * suite).
 *
 * @module services/messaging/providers/__tests__/registry.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('resolveMessagingProvider (#266 env switch)', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_BACKEND_PROVIDER;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_BACKEND_PROVIDER;
    else process.env.NEXT_PUBLIC_BACKEND_PROVIDER = ORIGINAL;
    vi.resetModules();
  });

  it('defaults to the supabase provider when the env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_BACKEND_PROVIDER;
    const { resolveMessagingProvider } = await import('../index');
    expect(resolveMessagingProvider().name).toBe('supabase');
  });

  it('selects the supabase provider when NEXT_PUBLIC_BACKEND_PROVIDER=supabase', async () => {
    process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'supabase';
    const { resolveMessagingProvider } = await import('../index');
    expect(resolveMessagingProvider().name).toBe('supabase');
  });

  it('selects the dotnet provider when NEXT_PUBLIC_BACKEND_PROVIDER=dotnet', async () => {
    process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'dotnet';
    const { resolveMessagingProvider } = await import('../index');
    expect(resolveMessagingProvider().name).toBe('dotnet');
  });

  it('an injected override wins over the env-configured selection', async () => {
    process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'supabase';
    const { resolveMessagingProvider } = await import('../index');
    const fake = { name: 'dotnet' as const } as ReturnType<
      typeof resolveMessagingProvider
    >;
    expect(resolveMessagingProvider(fake)).toBe(fake);
  });
});
