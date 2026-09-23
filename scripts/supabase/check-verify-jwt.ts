#!/usr/bin/env tsx
/**
 * Does the live project still match the declared `verify_jwt` table? (#1188)
 *
 * WHY A CHECKER AND NOT JUST A TABLE. A table nobody compares is a comment. This flag is
 * changeable from the Supabase dashboard, invisibly, and the consequence is asymmetric:
 * flipping it ON for a provider webhook 401s every delivery (the #1180 shape — a month of
 * silence), and flipping it OFF removes a platform auth gate with nothing to notice.
 *
 * READ-ONLY BY CONSTRUCTION. There is no `--fix`. Reconciling means either deploying with the
 * declared value or deliberately updating the table — both decisions, neither a side effect of
 * running a check.
 *
 * Skips rather than fails without a token: a fork has none, and a checker that fails everyone
 * who cannot run it teaches people to ignore it (the #970 lesson).
 *
 * Usage:  pnpm supabase:check-jwt
 */

import { VERIFY_JWT, jwtDrift } from '../lib/edge-function-jwt';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF =
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ??
  process.env.SUPABASE_PROJECT_REF;

async function main(): Promise<void> {
  if (!TOKEN || !REF) {
    console.log(
      '[verify-jwt] skipped — SUPABASE_ACCESS_TOKEN and a project ref are required to read ' +
        'the live project. Nothing to compare against.'
    );
    return;
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/functions`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!res.ok) {
    console.error(
      `::error::[verify-jwt] could not read the project's functions (HTTP ${res.status}). ` +
        'Could-not-check is not a pass.'
    );
    process.exit(1);
  }

  const body = (await res.json()) as Array<{
    slug: string;
    verify_jwt?: boolean;
  }>;
  const live: Record<string, boolean> = {};
  for (const f of body) live[f.slug] = Boolean(f.verify_jwt);

  const drift = jwtDrift(live);
  console.log(
    `[verify-jwt] ${Object.keys(VERIFY_JWT).length} declared, ${Object.keys(live).length} live`
  );

  if (drift.length === 0) {
    console.log('[verify-jwt] the project matches the declared table.');
    return;
  }

  for (const d of drift) {
    if (d.kind === 'changed') {
      console.error(
        `::error::${d.slug}: verify_jwt is ${d.live} live but ${d.declared} in the table. ` +
          (d.live
            ? 'A provider webhook that cannot send a JWT will now 401 on every delivery (#1180).'
            : 'The platform auth gate has been removed from this endpoint.')
      );
    } else if (d.kind === 'undeclared') {
      console.error(
        `::error::${d.slug}: deployed but absent from the table, so a deploy has no value to ` +
          `replay for it. Add it (verify_jwt is ${d.live} live).`
      );
    } else {
      console.error(
        `::error::${d.slug}: declared but not deployed to this project. Either it was removed ` +
          'and the table is stale, or a deploy is missing.'
      );
    }
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(
    `::error::[verify-jwt] ${err instanceof Error ? err.message : err}`
  );
  process.exit(1);
});
