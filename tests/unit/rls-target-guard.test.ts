import { describe, it, expect, vi, afterEach } from 'vitest';
import { decide } from '../../scripts/lib/supabase-target';
import {
  rlsTargetDecision,
  assertRlsTargetApproved,
} from '../fixtures/rls-target';

/**
 * The RLS suite must not write to a project nobody authorised (#1234).
 *
 * Hostnames are invented: the guard's behaviour depends on "local vs not", and a real
 * project ref in a test file is exactly the kind of string this repo keeps out of source.
 */
const LOCAL = 'http://localhost:54321';
const REMOTE = 'https://abcdefghijklmnop.supabase.co';
const REMOTE_HOST = 'abcdefghijklmnop.supabase.co';

describe('rlsTargetDecision (#1234)', () => {
  it('allows a local stack', () => {
    expect(rlsTargetDecision({ NEXT_PUBLIC_SUPABASE_URL: LOCAL }).allowed).toBe(
      true
    );
  });

  it('refuses a remote project that nothing authorised', () => {
    const d = rlsTargetDecision({ NEXT_PUBLIC_SUPABASE_URL: REMOTE });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/remote/);
  });

  it('allows a remote project only when the override names that exact host', () => {
    expect(
      rlsTargetDecision({
        NEXT_PUBLIC_SUPABASE_URL: REMOTE,
        ALLOW_REMOTE_SUPABASE: REMOTE_HOST,
      }).allowed
    ).toBe(true);
    expect(
      rlsTargetDecision({
        NEXT_PUBLIC_SUPABASE_URL: REMOTE,
        ALLOW_REMOTE_SUPABASE: '1',
      }).allowed
    ).toBe(false);
  });

  it('judges the URL the suite USES, not the seeders’ SUPABASE_ADMIN_URL', () => {
    const env = { SUPABASE_ADMIN_URL: LOCAL, NEXT_PUBLIC_SUPABASE_URL: REMOTE };
    expect(rlsTargetDecision(env).allowed).toBe(false);
  });

  it('CONTROL: the plain seeder decision would have allowed that same environment', () => {
    // This is why the guard does not call decide(process.env) directly. If this ever flips,
    // the test above stops proving anything and needs rethinking.
    expect(
      decide({ SUPABASE_ADMIN_URL: LOCAL, NEXT_PUBLIC_SUPABASE_URL: REMOTE })
        .allowed
    ).toBe(true);
  });

  it('assertRlsTargetApproved throws with the target named', () => {
    expect(() =>
      assertRlsTargetApproved({ NEXT_PUBLIC_SUPABASE_URL: REMOTE })
    ).toThrow(new RegExp(REMOTE_HOST.replace(/\./g, '\\.')));
    expect(() =>
      assertRlsTargetApproved({ NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    ).not.toThrow();
  });
});

// vi.mock is hoisted to the top of the file, above any describe-scoped const, so the spy has
// to be hoisted with it. (First written describe-scoped: the refusal tests still passed —
// nothing reached createClient — and only the CONTROL below noticed the spy was not wired.)
const createClient = vi.hoisted(() => vi.fn(() => ({})));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('../rls/__setup__/cleanup-stale-impl', () => ({
  cleanupStaleScripthammerUsers: vi.fn(async () => ({
    usersRemoved: 0,
    errorsLogged: 0,
  })),
}));

describe('the suite’s entry points refuse before any client exists (#1234)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    createClient.mockClear();
  });

  const point = (url: string) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    vi.stubEnv('ALLOW_REMOTE_SUPABASE', '');
  };

  it('globalSetup refuses a remote target and never builds the service-role client', async () => {
    point(REMOTE);
    const { setup } = await import('../rls/__setup__/cleanup-stale');
    await expect(setup()).rejects.toThrow(/REFUSING/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('CONTROL: globalSetup against a local stack does build the client', async () => {
    point(LOCAL);
    const { setup } = await import('../rls/__setup__/cleanup-stale');
    await setup();
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('hasRlsTestEnvironment throws for a remote target instead of reporting "ready"', async () => {
    point(REMOTE);
    const { hasRlsTestEnvironment } = await import('../fixtures/test-users');
    expect(() => hasRlsTestEnvironment()).toThrow(/REFUSING/);
  });

  it('hasRlsTestEnvironment still skips (false) when credentials are absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { hasRlsTestEnvironment } = await import('../fixtures/test-users');
    expect(hasRlsTestEnvironment()).toBe(false);
  });

  it('no client — anon included — can be built against a remote target', async () => {
    point(REMOTE);
    const { createAnonClient, createServiceClient } = await import(
      '../fixtures/test-users'
    );
    expect(() => createAnonClient()).toThrow(/REFUSING/);
    expect(() => createServiceClient()).toThrow(/REFUSING/);
    expect(createClient).not.toHaveBeenCalled();
  });
});
