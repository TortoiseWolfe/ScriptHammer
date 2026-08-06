#!/usr/bin/env tsx
/**
 * auth_audit_logs retention — invoke cleanup_old_audit_logs() and prove it worked.
 *
 * #585: the function has existed since the initial migration and was NEVER
 * CALLED. The table COMMENT, two security audits and one E2E-teardown design
 * decision all cited its 90-day window as though it were in force. Ten months
 * later the oldest row was four months old and the table was the largest in the
 * database. This script is the missing caller.
 *
 * Usage:
 *   pnpm supabase:retention           # delete, then VERIFY nothing old remains
 *   pnpm supabase:retention --check   # report only; exit 1 if retention is not holding
 *
 * Env (identical pair to scripts/supabase/set-auth-config.ts — no service-role
 * key is used or needed here, which is the point: #574 is about getting that
 * credential out of CI, not moving it somewhere new):
 *   SUPABASE_ACCESS_TOKEN
 *   NEXT_PUBLIC_SUPABASE_PROJECT_REF (or SUPABASE_PROJECT_REF)
 *
 * NEVER log deleted rows. auth_audit_logs rows carry ip_address, user_agent and
 * event_data. Counts only. scripts/cleanup-expired-intents.ts:73-78 prints
 * customer_email for each row it deletes — that is the pattern to avoid.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Must match the INTERVAL inside cleanup_old_audit_logs(). Not merely asserted —
 * assertWindowMatchesMigration() below reads the migration and fails if these
 * two drift apart. A retention number that lives in two places and is checked in
 * neither is how #585 happened in the first place.
 */
const RETENTION_DAYS = 90;

const MIGRATION_PATH =
  'supabase/migrations/20251006_complete_monolithic_setup.sql';

type Row = Record<string, unknown>;

function usage(code: number): never {
  console.log(
    'Usage: tsx scripts/supabase/cleanup-audit-logs.ts [--check]\n' +
      '  (no flag)  delete rows past the retention window, then verify\n' +
      '  --check    report only; exit 1 if rows exist past the window'
  );
  process.exit(code);
}

/**
 * The window is declared here AND in the migration. Read the migration and
 * compare, so a change to one that forgets the other fails loudly instead of
 * silently enforcing a different number than every document claims.
 */
function assertWindowMatchesMigration(): void {
  let sql: string;
  try {
    sql = readFileSync(resolve(process.cwd(), MIGRATION_PATH), 'utf8');
  } catch {
    // Running somewhere without the repo checked out is not this script's
    // problem to solve, but silently skipping the check would make it a gate
    // that cannot fail. Say so.
    console.warn(
      `⚠ could not read ${MIGRATION_PATH} — retention-window drift NOT checked`
    );
    return;
  }

  const fn = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION cleanup_old_audit_logs')
  );
  const match = /INTERVAL\s+'(\d+)\s+days'/i.exec(fn);

  if (!match) {
    console.error(
      `✗ Could not find the retention INTERVAL in cleanup_old_audit_logs().\n` +
        `  Either the function moved or its shape changed; this script can no\n` +
        `  longer prove the window it enforces matches the one it reports.`
    );
    process.exit(1);
  }

  const inMigration = Number(match[1]);
  if (inMigration !== RETENTION_DAYS) {
    console.error(
      `✗ Retention window drift.\n` +
        `    this script:   ${RETENTION_DAYS} days\n` +
        `    ${MIGRATION_PATH}: ${inMigration} days\n` +
        `  Update both, plus the documents that state the window (see #585).`
    );
    process.exit(1);
  }
}

async function query(api: string, token: string, sql: string): Promise<Row[]> {
  const res = await fetch(api, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();

    // A restricted project (#567) is not a retention defect, and failing daily
    // for the duration of a quota incident would train people to ignore this
    // job. Narrow on purpose: ONLY 402, and it still annotates. Every other
    // status is a real failure and exits non-zero.
    if (res.status === 402) {
      console.warn(
        `::warning::Supabase project is restricted (HTTP 402) — retention did not run. ` +
          `This is #567, not a retention failure. It resumes when the quota refills.`
      );
      process.exit(0);
    }

    throw new Error(`Management API ${res.status}: ${text}`);
  }

  return (await res.json()) as Row[];
}

function num(rows: Row[], key: string): number {
  const v = rows[0]?.[key];
  return typeof v === 'number' ? v : Number(v ?? 0);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let check = false;
  for (const a of argv) {
    if (a === '--check') check = true;
    else if (a === '--help' || a === '-h') usage(0);
    else if (a === '--') continue;
    else {
      console.error(`Unknown arg: ${a}`);
      usage(2);
    }
  }

  assertWindowMatchesMigration();

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ||
    process.env.SUPABASE_PROJECT_REF;

  if (!token) {
    console.error('✗ SUPABASE_ACCESS_TOKEN is not set.');
    process.exit(1);
  }
  if (!projectRef) {
    console.error(
      '✗ Neither NEXT_PUBLIC_SUPABASE_PROJECT_REF nor SUPABASE_PROJECT_REF is set.'
    );
    process.exit(1);
  }

  const api = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const CUTOFF = `NOW() - INTERVAL '${RETENTION_DAYS} days'`;
  const censusSql = `
    SELECT count(*)                                               AS total,
           count(*) FILTER (WHERE created_at < ${CUTOFF})         AS past_window,
           coalesce(min(created_at)::date::text, 'n/a')           AS oldest
    FROM auth_audit_logs`;

  const before = await query(api, token, censusSql);
  const beforeTotal = num(before, 'total');
  const beforePast = num(before, 'past_window');

  console.log(`auth_audit_logs — retention window ${RETENTION_DAYS} days`);
  console.log(`  rows total .......... ${beforeTotal}`);
  console.log(`  rows past window .... ${beforePast}`);
  console.log(`  oldest .............. ${before[0]?.oldest}`);

  if (check) {
    if (beforePast > 0) {
      console.error(
        `\n✗ ${beforePast} row(s) are past the ${RETENTION_DAYS}-day window.\n` +
          `  Retention is NOT being enforced. Run \`pnpm supabase:retention\`, and\n` +
          `  check that .github/workflows/data-retention.yml is still scheduled.`
      );
      process.exit(1);
    }
    console.log('\n✓ retention is holding — nothing past the window.');
    return;
  }

  if (beforePast === 0) {
    console.log('\n✓ nothing to delete.');
    return;
  }

  // Counts, never rows.
  const deleted = num(
    await query(api, token, 'SELECT cleanup_old_audit_logs() AS deleted'),
    'deleted'
  );
  console.log(`\n  deleted ............. ${deleted}`);

  // VERIFY. Without this the job reports success whenever the API returns 200,
  // which is exactly the shape of defect #585 documents: a retention claim with
  // nothing behind it.
  const afterPast = num(await query(api, token, censusSql), 'past_window');

  if (afterPast > 0) {
    // The function stops after p_max_batches (100 × 5000). A backlog past that
    // is legitimate partial progress, not a failure — tomorrow's run continues.
    if (deleted > 0) {
      console.log(
        `\n⚠ ${afterPast} row(s) still past the window — batch ceiling reached.\n` +
          `  Progress was made (${deleted} deleted); the next run continues.`
      );
      return;
    }
    console.error(
      `\n✗ ${afterPast} row(s) past the window and the call deleted NOTHING.\n` +
        `  cleanup_old_audit_logs() is not doing what its name says.`
    );
    process.exit(1);
  }

  console.log('\n✓ retention enforced — nothing past the window.');
}

main().catch((err) => {
  console.error(`\n✗ ${(err as Error).message}`);
  process.exit(1);
});
