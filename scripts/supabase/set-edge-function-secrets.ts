#!/usr/bin/env tsx
/**
 * Supabase Edge Function Secrets — diff / apply (CLI-free)
 *
 * Sets Edge Function secrets (Supabase Vault) via the Management API instead of
 * the `supabase secrets set` CLI — this repo forbids installing the Supabase CLI
 * locally (see CLAUDE.md "Docker-First Development"). Same auth pattern as
 * scripts/supabase/set-auth-config.ts: the SUPABASE_ACCESS_TOKEN + project ref
 * already in .env.
 *
 * Reads a desired-state config (default: `.env`, using an allow-list of Edge
 * Function keys; a legacy JSON sidecar remains supported with --config), fetches
 * the current secret NAMES from the Management API, prints a name-level diff
 * (NEW / UPDATE / unchanged — values are never printed), and optionally writes
 * them with --apply.
 *
 * Usage:
 *   pnpm supabase:secrets                      # dry-run (default) — name-level diff
 *   pnpm supabase:secrets --apply              # POST the secrets and verify
 *   pnpm supabase:secrets --config path        # optional .env or JSON sidecar
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN              — Management API token (dashboard → account/tokens)
 *   NEXT_PUBLIC_SUPABASE_PROJECT_REF   — short project ref (falls back to SUPABASE_PROJECT_REF)
 *
 * SECURITY: the GET endpoint returns plaintext secret values. This script NEVER
 * prints a value — only names and a masked last-4 fingerprint of the desired
 * value, so it is safe to run in a shared terminal or paste its output. On POSIX,
 * it also refuses config files with group or other permissions; use `chmod 600`.
 *
 * Note: the Management API rejects any secret name starting with `SUPABASE_`
 * (those — SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — are
 * auto-injected into Edge Functions by the platform). This script validates that
 * up-front and refuses with a clear message rather than a confusing 400.
 */

import { readFileSync, statSync } from 'node:fs';
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
    configPath: resolve(__dirname, '..', '..', '.env'),
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
        'Usage: tsx scripts/supabase/set-edge-function-secrets.ts [--apply] [--config <path>]'
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }

  return args;
}

type DesiredSecrets = Record<string, string>;
type RemoteSecret = { name: string; value: string; updated_at?: string };

/**
 * Refuse to inspect a config whose POSIX permissions expose it beyond its owner.
 *
 * A gitignored file can still be read by other local accounts, backups, or sync
 * processes. Check metadata before reading its contents or consulting credentials,
 * so an unsafe file cannot cause a request to the Management API.
 */
function assertPrivateConfigFile(configPath: string): void {
  // Windows ACLs are not represented by POSIX mode bits. The caller's platform
  // security model must enforce access there rather than treating a synthetic mode
  // as meaningful.
  if (process.platform === 'win32') return;

  let mode: number;
  try {
    mode = statSync(configPath).mode & 0o777;
  } catch (err) {
    console.error(
      `✗ Could not inspect permissions for ${configPath}: ${(err as Error).message}`
    );
    console.error(
      '  Create the config first, then restrict it with: chmod 600 <path>'
    );
    process.exit(1);
  }

  if ((mode & 0o077) === 0) return;

  console.error(
    `✗ Refusing to read ${configPath}: mode 0${mode.toString(8).padStart(3, '0')} permits group or other access.`
  );
  console.error(
    '  This config may contain payment and service credentials. Make it owner-only:'
  );
  console.error(`  chmod 600 ${JSON.stringify(configPath)}`);
  console.error('  No config was read and no Management API request was made.');
  process.exit(1);
}

/** Last-4 fingerprint that never reveals the secret. */
function fingerprint(value: string): string {
  if (value.length <= 4) return '••••';
  return `…${value.slice(-4)}`;
}

async function listSecretNames(
  projectRef: string,
  token: string
): Promise<Set<string>> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `GET /secrets returned ${res.status} ${res.statusText}: ${body.slice(0, 300)}`
    );
  }
  // The response includes plaintext `value`s — we deliberately keep only `name`.
  const remote = (await res.json()) as RemoteSecret[];
  return new Set(remote.map((s) => s.name));
}

async function createSecrets(
  projectRef: string,
  token: string,
  secrets: DesiredSecrets
): Promise<void> {
  const payload = Object.entries(secrets).map(([name, value]) => ({
    name,
    value,
  }));
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `POST /secrets returned ${res.status} ${res.statusText}: ${body.slice(0, 300)}`
    );
  }
}

/** Names the Management API will reject (auto-injected by the platform). */
function validateNames(secrets: DesiredSecrets): void {
  const offenders = Object.keys(secrets).filter((n) =>
    n.startsWith('SUPABASE_')
  );
  if (offenders.length > 0) {
    console.error(
      `✗ These secret names start with SUPABASE_ and are rejected by the Management API\n` +
        `  (the platform auto-injects them into Edge Functions): ${offenders.join(', ')}\n` +
        `  Remove them from the config.`
    );
    process.exit(1);
  }
  const empty = Object.entries(secrets)
    .filter(([, v]) => typeof v !== 'string' || v.length === 0)
    .map(([k]) => k);
  if (empty.length > 0) {
    console.error(
      `✗ These secrets have empty/non-string values — fill them in the config: ${empty.join(', ')}`
    );
    process.exit(1);
  }
}

/**
 * Which `.env` keys are Edge Function secrets.
 *
 * An allow-list, NOT "everything in .env". The file also holds GH_TOKEN, the
 * Supabase access token, test-user passwords and local UID/GID — none of which any
 * Edge Function should ever see, and several of which would be actively dangerous
 * in the function runtime.
 */
const EDGE_SECRET_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
  'NEXT_PUBLIC_SITE_URL',
  'RESEND_API_KEY',
] as const;

/**
 * Read the desired secrets from `.env` by default.
 *
 * WAS a separate `edge-function-secrets.json`. That file had to be kept in sync with
 * `.env` by hand, sat at mode 644 (#614), and split the answer to "where are this
 * project's secrets?" across two places — which is why a full credential rotation
 * could not be scripted, and why the OAuth and Turnstile secrets were nowhere at all
 * when the Supabase project was deleted (#567).
 *
 * A `.json` path still works when explicitly supplied with --config, so an operator
 * with an existing sidecar is not broken. Every config is checked before it is read:
 * on POSIX it must have no group or other permissions (for example, `chmod 600`).
 */
function readDesiredSecrets(configPath: string): DesiredSecrets {
  const raw = readFileSync(configPath, 'utf8');

  if (configPath.endsWith('.json')) {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('config must be a JSON object of { "NAME": "value" }');
    }
    // Keys beginning with "_" are comments/metadata, never sent as secrets.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([k]) => !k.startsWith('_')
      )
    ) as DesiredSecrets;
  }

  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    // Empty values are the deliberate placeholders for credentials that are not
    // recoverable yet (OAuth, Turnstile). Pushing an empty string would overwrite a
    // good value in the vault with nothing, so skip them.
    const val = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!val) continue;
    if ((EDGE_SECRET_KEYS as readonly string[]).includes(key)) out[key] = val;
  }
  return out as DesiredSecrets;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // This must stay before credential validation and readDesiredSecrets(): otherwise
  // an unsafe config can be read or a request can begin before we refuse it.
  assertPrivateConfigFile(args.configPath);

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  // Mirror set-auth-config.ts: accept either ref var name.
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

  let desired: DesiredSecrets;
  try {
    desired = readDesiredSecrets(args.configPath);
  } catch (err) {
    console.error(
      `✗ Could not read ${args.configPath}: ${(err as Error).message}`
    );
    console.error(
      '  Secrets live in .env. See the "Payment provider secrets" block there.'
    );
    process.exit(1);
  }

  const names = Object.keys(desired);
  if (names.length === 0) {
    console.error('✗ Config has no secrets. Nothing to do.');
    process.exit(1);
  }

  validateNames(desired);

  console.log(`Project: ${projectRef}`);
  console.log(`Config:  ${args.configPath}`);
  console.log(`Mode:    ${args.apply ? 'APPLY' : 'dry-run (default)'}`);
  console.log();

  console.log('Fetching current secret names...');
  const existing = await listSecretNames(projectRef, token);

  const keyWidth = Math.max(...names.map((n) => n.length), 20);
  console.log();
  console.log(`Secrets in config (${names.length}) — values masked:`);
  console.log();
  for (const name of names) {
    const action = existing.has(name) ? 'UPDATE' : 'NEW   ';
    console.log(
      `  [${action}] ${name.padEnd(keyWidth)}  value ${fingerprint(desired[name])}`
    );
  }
  console.log();

  if (!args.apply) {
    console.log('Dry-run — no changes made. Re-run with --apply to write.');
    return;
  }

  console.log('POSTing secrets to Supabase Vault...');
  await createSecrets(projectRef, token, desired);

  console.log('Verifying...');
  const after = await listSecretNames(projectRef, token);
  const missing = names.filter((n) => !after.has(n));
  if (missing.length > 0) {
    console.error(
      `✗ Verification FAILED — not present after write: ${missing.join(', ')}`
    );
    process.exit(1);
  }

  console.log(
    `✓ ${names.length} secret(s) set and verified in Supabase Vault.`
  );
  console.log('  Edge Functions pick up new secrets on their next cold start.');
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
