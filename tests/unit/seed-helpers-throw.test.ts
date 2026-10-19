/**
 * #1378: seed helpers must throw with what they were seeding, never return null.
 * A null return let ~60 specs `test.skip(!fixture)` into a green run.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ADMIN_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const;

describe('seed helpers throw when the admin client is unavailable', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });

  it('requireAdminClient names what was being seeded', async () => {
    const { requireAdminClient } = await import(
      '../e2e/utils/test-user-factory'
    );
    expect(() => requireAdminClient('seedThing')).toThrow(/seedThing/);
    expect(() => requireAdminClient('seedThing')).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/
    );
  });

  it.each([
    ['createTestUser', (m: any) => m.createTestUser('a@b.test', 'Pw123456!')],
    ['seedIsolatedConversation', (m: any) => m.seedIsolatedConversation()],
    ['seedIsolatedConnection', (m: any) => m.seedIsolatedConnection()],
    ['seedIsolatedGroup', (m: any) => m.seedIsolatedGroup(2)],
    ['seedIsolatedSubscription', (m: any) => m.seedIsolatedSubscription()],
    ['seedIsolatedPayment', (m: any) => m.seedIsolatedPayment()],
    ['seedLiveStripeSubscription', (m: any) => m.seedLiveStripeSubscription()],
    ['seedIsolatedAdmin', (m: any) => m.seedIsolatedAdmin()],
    ['seedScrollFixture', (m: any) => m.seedScrollFixture('a@b.test')],
    [
      'promoteToOAuthAndReSignIn',
      (m: any) =>
        m.promoteToOAuthAndReSignIn({
          id: 'x',
          email: 'a@b.test',
          password: 'p',
        }),
    ],
  ])('%s rejects instead of resolving null', async (name, call) => {
    const mod = await import('../e2e/utils/test-user-factory');
    await expect(call(mod)).rejects.toThrow(new RegExp(name));
  });
});
