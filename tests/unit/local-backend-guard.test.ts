import { describe, it, expect, afterEach } from 'vitest';
import {
  isLocalSupabaseUrl,
  assertLocalBackend,
} from '../e2e/utils/test-user-factory';

/**
 * The local-backend guard must be able to REFUSE (#944).
 *
 * The admin E2E specs call themselves local-only and nothing made that true:
 * `getAdminClient()` resolves `SUPABASE_ADMIN_URL || NEXT_PUBLIC_SUPABASE_URL`, and the repo's
 * default cloud `.env` sets the second to the hosted project and the first not at all — so the
 * fallback lands on PRODUCTION, where `seedIsolatedAdmin()` creates and promotes a real admin
 * account with the service-role key. What stopped it was `CI=true` at docker-compose.yml:84
 * tripping a `test.skip` whose stated reason is a capability one, not a safety one.
 *
 * A guard that has only ever been exercised on a correct configuration proves nothing, so both
 * directions are driven here — including the empty case, which is the one most likely to be
 * treated as safe by accident.
 */

const ORIGINAL = {
  admin: process.env.SUPABASE_ADMIN_URL,
  publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

afterEach(() => {
  if (ORIGINAL.admin === undefined) delete process.env.SUPABASE_ADMIN_URL;
  else process.env.SUPABASE_ADMIN_URL = ORIGINAL.admin;
  if (ORIGINAL.publicUrl === undefined)
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL.publicUrl;
});

describe('isLocalSupabaseUrl', () => {
  it.each([
    'http://localhost:54321',
    'http://127.0.0.1:54321',
    'http://host.docker.internal:54321',
    'http://supabase-kong:8000',
    'https://localhost:54321',
  ])('accepts the local stack: %s', (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(true);
  });

  it.each([
    'https://ozbdyopxmeqmwnfsmglp.supabase.co',
    'https://anything.supabase.co',
    'https://supabase.example.com',
    'https://10.0.0.5',
  ])('REFUSES a remote backend: %s', (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });

  it.each([undefined, null, '', 'not a url', 'supabase-kong:8000'])(
    'refuses what it cannot verify: %s',
    (url) => {
      // Absence of evidence is not evidence of a local backend. `supabase-kong:8000`
      // without a scheme does not parse as a URL, and guessing would be exactly the
      // reassurance this guard exists to withhold.
      expect(isLocalSupabaseUrl(url as string | undefined)).toBe(false);
    }
  );

  it('is not fooled by a hostname that merely contains a local name', () => {
    // A blocklist would have to anticipate this; the allowlist gets it for free.
    expect(isLocalSupabaseUrl('https://localhost.attacker.example')).toBe(
      false
    );
    expect(isLocalSupabaseUrl('https://supabase-kong.example.com')).toBe(false);
  });
});

describe('assertLocalBackend', () => {
  it('passes on a local backend', () => {
    process.env.SUPABASE_ADMIN_URL = 'http://supabase-kong:8000';
    expect(() => assertLocalBackend('spec')).not.toThrow();
  });

  it('THROWS on the cloud project — the #944 case', () => {
    delete process.env.SUPABASE_ADMIN_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://myproject.supabase.co';
    expect(() => assertLocalBackend('admin specs')).toThrow(
      /refuses to run against a non-local Supabase/
    );
  });

  it('names the resolved backend, so the message is actionable', () => {
    delete process.env.SUPABASE_ADMIN_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://myproject.supabase.co';
    expect(() => assertLocalBackend('admin specs')).toThrow(
      /https:\/\/myproject\.supabase\.co/
    );
  });

  it('THROWS when nothing is set, rather than assuming local', () => {
    delete process.env.SUPABASE_ADMIN_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => assertLocalBackend('admin specs')).toThrow(/empty/);
  });

  it('honours SUPABASE_ADMIN_URL over the public URL, matching getAdminClient', () => {
    // getAdminClient resolves `SUPABASE_ADMIN_URL || NEXT_PUBLIC_SUPABASE_URL`. If the guard
    // read them in the other order it would check a different backend from the one the
    // fixture actually writes to — a guard pointed somewhere it cannot observe (#396).
    process.env.SUPABASE_ADMIN_URL = 'http://supabase-kong:8000';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://myproject.supabase.co';
    expect(() => assertLocalBackend('spec')).not.toThrow();
  });
});
