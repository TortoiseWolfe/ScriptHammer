/**
 * Refuse a non-local Supabase before anything writes to it (#944, #959).
 *
 * WHY THIS IS ITS OWN MODULE. The guard used to live in
 * `tests/e2e/utils/test-user-factory.ts`, which imports `@playwright/test`,
 * `KeyDerivationService`, `GroupKeyService` and two more E2E helpers. Anything
 * outside Playwright that wanted the guard had to drag all of that into its
 * module graph, so `tests/supabase-admin.ts` — a plain vitest/tsx helper, and the
 * last unguarded service-role client in the tree — simply went without one.
 *
 * Nothing here imports anything. That is the feature.
 */

const LOCAL_SUPABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'host.docker.internal',
  'supabase-kong',
]);

/**
 * Is this URL unambiguously a local Supabase stack? (#944)
 *
 * Pure, so `tests/unit/local-backend-guard.test.ts` can drive both directions
 * without a network or a container — the only way to know a guard can refuse.
 *
 * An EMPTY or unparseable URL is `false`. Absence of evidence is not evidence of
 * a local backend, and treating it as one is how a guard reports reassurance.
 */
export function isLocalSupabaseUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return LOCAL_SUPABASE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** The backend a service-role client would actually reach, in priority order. */
export function resolveBackendUrl(env = process.env): string {
  return env.SUPABASE_ADMIN_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
}

export function assertLocalBackend(what = 'this spec'): void {
  const resolved = resolveBackendUrl();
  if (isLocalSupabaseUrl(resolved)) return;
  throw new Error(
    `${what} seeds and mutates data, so it refuses to run against a non-local Supabase.\n` +
      `  resolved backend: ${resolved || '(empty — SUPABASE_ADMIN_URL and NEXT_PUBLIC_SUPABASE_URL are both unset)'}\n` +
      `  allowed hosts:    ${[...LOCAL_SUPABASE_HOSTS].join(', ')}\n` +
      'Switch with `pnpm dev:local` (writes .env.local-supabase), then bring the stack up with\n' +
      '`docker compose --profile supabase up -d --force-recreate` — a plain restart keeps the old env.\n' +
      'See #944; the same trap wrote to production in #877.'
  );
}
