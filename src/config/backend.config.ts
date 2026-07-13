/**
 * Backend Provider Configuration (#266)
 *
 * Selects which backend the messaging domain talks to, so the same UI and
 * services run unchanged against either Supabase or a .NET/EF Core backend —
 * chosen by flipping a single environment variable. This is the first step of
 * the enterprise-readiness arc (epic #280): a swappable, non-vendor-locked
 * backend.
 *
 * Mirrors the env-var-provider precedent in `calendar.config.ts`
 * (`NEXT_PUBLIC_CALENDAR_PROVIDER`): cast `process.env.X` to a string-literal
 * union and fall back to a safe default.
 *
 * @module config/backend
 */

/**
 * Which messaging backend implementation is active.
 * - `supabase` — today's Supabase (PostgREST + RLS + Realtime) backend. Default.
 * - `dotnet`   — an ASP.NET Core + EF Core backend (KDG-style), reached over a
 *                typed REST client. See `DotnetMessagingProvider`.
 */
export type BackendProvider = 'supabase' | 'dotnet';

export interface BackendConfig {
  /** The active backend provider. Defaults to `supabase`. */
  provider: BackendProvider;
  /**
   * Base URL of the .NET messaging API (only used when `provider === 'dotnet'`).
   * e.g. `https://api.example.com`. Undefined leaves the .NET provider inert.
   */
  dotnetBaseUrl?: string;
}

export const backendConfig: BackendConfig = {
  provider:
    (process.env.NEXT_PUBLIC_BACKEND_PROVIDER as BackendProvider) || 'supabase',
  dotnetBaseUrl: process.env.NEXT_PUBLIC_DOTNET_API_URL,
};
