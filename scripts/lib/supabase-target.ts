/**
 * Resolve, announce and gate the Supabase project a script is about to write to (#877).
 *
 * WHY THIS EXISTS. On 2026-08-21 `pnpm run seed:local` wrote to the **cloud** project and
 * gave every account in it an `accepted` connection to every other account — which, per the
 * messaging authorization contract, is permission to message. ~18 of those accounts belong
 * to real people. Nothing in the path said "cloud": the script name says local, and the
 * resolved URL was never printed.
 *
 * The name was not the bug. The bug was that a script holding the service-role key resolved
 * its target silently, so being wrong looked exactly like being right.
 *
 * TWO RULES, and the second is the one that matters:
 *
 *   1. ALWAYS PRINT THE TARGET, before doing anything. A destination you can read is a
 *      destination you can question.
 *   2. REFUSE A REMOTE TARGET unless the caller names it. `ALLOW_REMOTE_SUPABASE` must equal
 *      the hostname being written to — not `1`, not `true`. A blanket flag gets exported once
 *      and forgotten, and then protects nothing; naming the host means you cannot authorise
 *      production while believing you are pointed at localhost.
 *
 * `reset-database.ts` additionally puts the target inside its confirmation prompt. It already
 * asked you to type RESET; it never said what it was about to destroy, which makes the
 * confirmation a formality rather than a decision.
 */

/** Hosts that are unambiguously a local stack. */
const LOCAL_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '[::1]',
  // Compose-internal names for the local stack. `supabase-kong` is how the app container
  // reaches Kong; `host.docker.internal` is how a container reaches the host's published
  // port. Both are the local stack, reached by different routes.
  'supabase-kong',
  'host.docker.internal',
  'kong',
]);

/** Only the three variables these functions read — not the whole process environment. */
export type SupabaseEnv = Record<string, string | undefined>;

export interface SupabaseTarget {
  url: string;
  host: string;
  isLocal: boolean;
  /** Short human label for logs: 'local' or the hostname. */
  label: string;
}

/**
 * Classify a Supabase URL as local or remote.
 *
 * An unparseable URL is treated as REMOTE. Failing safe means refusing, not proceeding: a
 * string this cannot understand is exactly when you least want it guessing.
 */
export function classify(url: string): SupabaseTarget {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return {
      url,
      host: '<unparseable>',
      isLocal: false,
      label: '<unparseable>',
    };
  }
  const isLocal = LOCAL_HOSTS.has(host);
  return { url, host, isLocal, label: isLocal ? `local (${host})` : host };
}

/** The URL a script will actually use, resolved the same way the seeders do. */
export function resolveUrl(env: SupabaseEnv = process.env): string | undefined {
  return env.SUPABASE_ADMIN_URL || env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Decide whether a write may proceed. Pure, so it can be tested without a process.
 *
 * Returns `{ allowed, target, reason }`.
 */
export function decide(env: SupabaseEnv = process.env): {
  allowed: boolean;
  target: SupabaseTarget | null;
  reason: string;
} {
  const url = resolveUrl(env);
  if (!url) {
    return {
      allowed: false,
      target: null,
      reason:
        'no SUPABASE_ADMIN_URL or NEXT_PUBLIC_SUPABASE_URL set — refusing rather than guessing',
    };
  }

  const target = classify(url);
  if (target.isLocal) {
    return { allowed: true, target, reason: `local target (${target.host})` };
  }

  const allow = env.ALLOW_REMOTE_SUPABASE;
  if (allow && allow === target.host) {
    return {
      allowed: true,
      target,
      reason: `remote target explicitly authorised by name (${target.host})`,
    };
  }
  if (allow) {
    return {
      allowed: false,
      target,
      reason: `ALLOW_REMOTE_SUPABASE is "${allow}" but the target is "${target.host}" — the override must name the host it authorises`,
    };
  }
  return {
    allowed: false,
    target,
    reason: `refusing to write to the remote project "${target.host}"`,
  };
}

/**
 * Announce the target and exit(1) unless the write is allowed.
 *
 * Call this FIRST in any script that holds the service-role key.
 */
export function requireApprovedTarget(scriptName: string): SupabaseTarget {
  const { allowed, target, reason } = decide();

  console.log(`\n🎯 ${scriptName} → ${target?.url ?? '(no target resolved)'}`);

  if (allowed) {
    if (target && !target.isLocal) {
      console.log(
        `⚠️  REMOTE target, authorised by ALLOW_REMOTE_SUPABASE=${target.host}`
      );
    }
    return target as SupabaseTarget;
  }

  console.error(`\n❌ ${reason}`);
  if (target && !target.isLocal) {
    console.error(
      '\n   This is not a local stack. On 2026-08-21 a seeder run against a remote\n' +
        '   project connected every real user in it to every other user (#877).\n\n' +
        '   If you genuinely mean it, name the host:\n' +
        `     ALLOW_REMOTE_SUPABASE=${target.host} <your command>\n\n` +
        '   For the local stack, point the script at it explicitly:\n' +
        '     SUPABASE_ADMIN_URL=http://supabase-kong:8000 <your command>'
    );
  }
  process.exit(1);
}
