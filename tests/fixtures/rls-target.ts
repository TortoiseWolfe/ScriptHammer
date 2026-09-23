/**
 * Where may the RLS suite write? (#1234)
 *
 * `pnpm test:rls` creates and deletes real users with the SERVICE-ROLE key. It used to decide
 * whether it could run by checking that three environment variables were non-empty, so a
 * container pointed at the cloud project — `pnpm dev:cloud`, or a `.env` aimed at production —
 * satisfied it, and the suite started minting users on the live project. That is #877's shape
 * (`seed:local` meshed every real user together) and #944's (E2E seeding an admin onto
 * production), a third time, in the one suite whose job is proving the security boundary.
 *
 * The classifier already exists in `scripts/lib/supabase-target.ts`; this routes the suite
 * through it rather than inventing a second opt-in. The escape hatch is the same one the
 * seeders use: `ALLOW_REMOTE_SUPABASE=<the exact hostname>`.
 *
 * ONE TRAP, and it is why this does not simply call `decide(process.env)`: `decide()` resolves
 * `SUPABASE_ADMIN_URL || NEXT_PUBLIC_SUPABASE_URL`, the seeders' order. This suite connects to
 * `NEXT_PUBLIC_SUPABASE_URL` and nothing else. With `SUPABASE_ADMIN_URL` pointed at a local
 * stack and the public URL at production, `decide()` would answer "local" while every client
 * here went to production. So the decision is made on the URL the suite actually uses.
 *
 * It REFUSES rather than skips. A skipped security suite reads exactly like a passing one.
 *
 * The message deliberately does not start with a bracketed tag. Tailwind scans this
 * repository wholesale — comments included — and reads a square-bracketed `name:value` as an
 * arbitrary-property class, so such a tag here shipped as a production CSS rule and moved a
 * stylesheet hash (#1279). Do not spell the pattern out in this comment either.
 */
import { decide, type SupabaseEnv } from '../../scripts/lib/supabase-target';

export function rlsTargetDecision(env: SupabaseEnv = process.env) {
  // Only the suite's own URL and the named override — nothing that could redirect resolution.
  return decide({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    ALLOW_REMOTE_SUPABASE: env.ALLOW_REMOTE_SUPABASE,
  });
}

/** Throws, with the target named, unless the suite's URL is local or explicitly authorised. */
export function assertRlsTargetApproved(env: SupabaseEnv = process.env): void {
  const { allowed, target, reason } = rlsTargetDecision(env);
  if (allowed) return;
  throw new Error(
    `test:rls REFUSING to run against ${target?.url ?? '(no URL)'}: ${reason}. ` +
      'This suite creates and deletes users with the service-role key. Point ' +
      'NEXT_PUBLIC_SUPABASE_URL at a local stack (`docker compose --profile supabase up`), ' +
      'or — only if you mean it — set ALLOW_REMOTE_SUPABASE to that exact hostname.'
  );
}
