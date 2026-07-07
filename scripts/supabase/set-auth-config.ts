#!/usr/bin/env tsx
/**
 * Supabase Auth Config — GET / diff / apply
 *
 * Reads a desired-state JSON (default: scripts/supabase/auth-config.json),
 * fetches the current auth config from the Supabase Management API, prints
 * a diff, and optionally applies the change with --apply.
 *
 * Usage:
 *   pnpm supabase:auth-config                    # dry-run (default)
 *   pnpm supabase:auth-config --apply            # PATCH and verify
 *   pnpm supabase:auth-config --config path.json # override config path
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN              — Management API token (from dashboard)
 *   NEXT_PUBLIC_SUPABASE_PROJECT_REF   — short project ref, e.g. "abcd1234"
 *
 * Both are in .env.local (gitignored). Script refuses to run without them.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CliArgs = {
  apply: boolean;
  configPath: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    apply: false,
    configPath: resolve(__dirname, 'auth-config.json'),
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') {
      args.apply = true;
    } else if (a === '--config') {
      const next = argv[i + 1];
      if (!next) {
        console.error('--config requires a path argument');
        process.exit(2);
      }
      args.configPath = resolve(process.cwd(), next);
      i++;
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: tsx scripts/supabase/set-auth-config.ts [--apply] [--config <path>]'
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }

  return args;
}

type AuthConfig = Record<string, unknown>;

async function getAuthConfig(
  projectRef: string,
  token: string
): Promise<AuthConfig> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `GET /config/auth returned ${res.status} ${res.statusText}: ${body.slice(0, 300)}`
    );
  }
  return (await res.json()) as AuthConfig;
}

async function patchAuthConfig(
  projectRef: string,
  token: string,
  patch: AuthConfig
): Promise<AuthConfig> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `PATCH /config/auth returned ${res.status} ${res.statusText}: ${body.slice(0, 300)}`
    );
  }
  return (await res.json()) as AuthConfig;
}

function computeDiff(
  current: AuthConfig,
  desired: AuthConfig
): { key: string; from: unknown; to: unknown }[] {
  const diff: { key: string; from: unknown; to: unknown }[] = [];
  for (const key of Object.keys(desired)) {
    const curVal = current[key];
    const desVal = desired[key];
    if (JSON.stringify(curVal) !== JSON.stringify(desVal)) {
      diff.push({ key, from: curVal, to: desVal });
    }
  }
  return diff;
}

function formatValue(v: unknown): string {
  if (v === undefined) return '(unset)';
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return JSON.stringify(v);
}

function printDiff(diff: { key: string; from: unknown; to: unknown }[]): void {
  if (diff.length === 0) {
    console.log('✓ No changes needed — remote already matches desired config.');
    return;
  }
  const keyWidth = Math.max(...diff.map((d) => d.key.length), 20);
  console.log(`Proposed changes (${diff.length}):`);
  console.log();
  console.log(`  ${'KEY'.padEnd(keyWidth)}  ${'FROM'.padEnd(22)}  →  TO`);
  console.log(
    `  ${'-'.repeat(keyWidth)}  ${'-'.repeat(22)}     ${'-'.repeat(22)}`
  );
  for (const d of diff) {
    console.log(
      `  ${d.key.padEnd(keyWidth)}  ${formatValue(d.from).padEnd(22)}  →  ${formatValue(d.to)}`
    );
  }
  console.log();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  // Accept either var name — the repo has historically used both
  // NEXT_PUBLIC_SUPABASE_PROJECT_REF (docs/CLAUDE.md) and SUPABASE_PROJECT_REF
  // (actual .env). Prefer the canonical one, fall back to the shorter.
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ||
    process.env.SUPABASE_PROJECT_REF;

  if (!token) {
    console.error('✗ SUPABASE_ACCESS_TOKEN is not set.');
    console.error(
      '  Add it to .env (or .env.local, gitignored). Get one from:'
    );
    console.error('  https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }
  if (!projectRef) {
    console.error(
      '✗ Neither NEXT_PUBLIC_SUPABASE_PROJECT_REF nor SUPABASE_PROJECT_REF is set.'
    );
    console.error('  Add one to .env (or .env.local, gitignored).');
    process.exit(1);
  }

  let desired: AuthConfig;
  try {
    const raw = readFileSync(args.configPath, 'utf8');
    desired = JSON.parse(raw) as AuthConfig;
  } catch (err) {
    console.error(
      `✗ Could not read/parse ${args.configPath}: ${(err as Error).message}`
    );
    process.exit(1);
  }

  console.log(`Project: ${projectRef}`);
  console.log(`Config:  ${args.configPath}`);
  console.log(`Mode:    ${args.apply ? 'APPLY' : 'dry-run (default)'}`);
  console.log();

  console.log('Fetching current auth config...');
  const current = await getAuthConfig(projectRef, token);

  const diff = computeDiff(current, desired);
  printDiff(diff);

  if (!args.apply) {
    console.log('Dry-run — no changes made. Re-run with --apply to commit.');
    return;
  }

  if (diff.length === 0) {
    console.log('Nothing to apply.');
    return;
  }

  const patch: AuthConfig = {};
  for (const { key, to } of diff) patch[key] = to;

  console.log('Applying PATCH...');
  await patchAuthConfig(projectRef, token, patch);

  console.log('Verifying...');
  const after = await getAuthConfig(projectRef, token);
  const residual = computeDiff(after, desired);
  if (residual.length > 0) {
    console.error('✗ Verification FAILED — some fields did not stick:');
    for (const r of residual) {
      console.error(
        `  ${r.key}: got ${formatValue(r.from)}, wanted ${formatValue(r.to)}`
      );
    }
    console.error(
      '  The Management API may not accept these fields on your plan.'
    );
    process.exit(1);
  }

  console.log('✓ All changes applied and verified.');
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
