/**
 * Generate contract test fixtures from live Supabase RPCs.
 *
 * Uses the Supabase Management API to call each admin_* RPC with JWT claims
 * set to an admin user. Writes the JSON responses to tmp-live-rpc/.
 *
 * Prerequisites:
 *   - Supabase instance running (pnpm run prime if paused)
 *   - seed-admin-demo.sql applied (idempotent, safe to re-run)
 *   - SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN in .env
 *
 * Usage:
 *   docker compose exec scripthammer pnpm exec tsx scripts/generate-contract-fixtures.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || !token) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN in env');
  process.exit(1);
}

const DIR = join(process.cwd(), 'tmp-live-rpc');
const API = `https://api.supabase.com/v1/projects/${ref}/database/query`;

const ADMIN_CLAIMS = JSON.stringify({
  sub: '00000000-0000-0000-0000-000000000001',
  app_metadata: { is_admin: true },
});

async function queryRpc(rpc: string, args = ''): Promise<unknown> {
  // set_config with false persists for the session; the Management API
  // runs both statements in the same connection.
  const sql = [
    `SELECT set_config('request.jwt.claims', '${ADMIN_CLAIMS}', false)`,
    `SELECT ${rpc}(${args})`,
  ].join(';\n');

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Management API ${res.status}: ${text}`);
  }

  const rows = await res.json();
  // The API returns the result of the last SELECT as an array of rows.
  // Each row has a single key matching the function name.
  const row = rows[0];
  return row[rpc];
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  console.log('Generating contract fixtures from live Supabase RPCs...');

  // 30-day window captures all seed data (spread over 14 days from now())
  const trendArgs = `now() - interval '30 days', now()`;
  const overviewArgs = `now() - interval '30 days', now()`;

  const fixtures: [string, string, string][] = [
    ['messaging_trends.json', 'admin_messaging_trends', trendArgs],
    ['admin_messaging_stats.json', 'admin_messaging_stats', ''],
    ['admin_payment_trends.json', 'admin_payment_trends', trendArgs],
    ['admin_payment_stats.json', 'admin_payment_stats', ''],
    ['admin_list_users.json', 'admin_list_users', ''],
    ['admin_overview.json', 'admin_overview', overviewArgs],
  ];

  for (const [file, rpc, args] of fixtures) {
    const data = await queryRpc(rpc, args);
    writeFileSync(join(DIR, file), JSON.stringify(data, null, 2) + '\n');
    console.log(`  ✓ ${file}`);
  }

  console.log('Done — fixtures written to tmp-live-rpc/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
