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
// Shared with scripts/__tests__/secret-digest.test.js — `pnpm test:scripts` runs plain
// `node --test`, which cannot import a .ts, so the pure logic lives in a .mjs (#1182).
import { classifySecrets, digest } from './secret-digest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CliArgs = {
  apply: boolean;
  configPath: string;
  /** Overwrite a deployed value that DIFFERS from the local one. */
  force: boolean;
  /** Restrict the run to these names. Empty means every name in the config. */
  only: string[];
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    apply: false,
    configPath: resolve(__dirname, '..', '..', '.env'),
    force: false,
    only: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') {
      args.apply = true;
    } else if (a === '--force') {
      args.force = true;
    } else if (a.startsWith('--only=')) {
      args.only.push(...a.slice('--only='.length).split(',').filter(Boolean));
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
        'Usage: tsx scripts/supabase/set-edge-function-secrets.ts [--apply] [--force]\n' +
          '            [--only=NAME[,NAME...]] [--config <path>]\n' +
          '\n' +
          '  --only=NAME  restrict the run to these names — rotating one credential should\n' +
          '               not require pushing all eight (#1182).\n' +
          '  --force      overwrite a deployed value that DIFFERS from the local one.\n' +
          '               Without it a divergence is REFUSED, because the deployed value\n' +
          '               may be the correct one and this script cannot read it back.'
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

async function listSecretDigests(
  projectRef: string,
  token: string
): Promise<Map<string, string>> {
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
  // `value` is a SHA-256 DIGEST, not the plaintext this comment used to claim. Keeping it
  // is what lets us tell "already correct" from "about to be silently replaced" (#1182).
  const remote = (await res.json()) as RemoteSecret[];
  return new Map(remote.map((s) => [s.name, s.value ?? '']));
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

  if (args.only.length > 0) {
    const unknown = args.only.filter((n) => !(n in desired));
    if (unknown.length > 0) {
      console.error(`✗ --only names not in the config: ${unknown.join(', ')}`);
      process.exit(1);
    }
    for (const n of Object.keys(desired)) {
      if (!args.only.includes(n)) delete desired[n];
    }
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

  console.log('Fetching current secret digests...');
  const existing = await listSecretDigests(projectRef, token);

  const keyWidth = Math.max(...names.map((n) => n.length), 20);
  console.log();
  console.log(`Secrets in config (${names.length}) — values masked:`);
  console.log();
  // THE POINT OF #1182. This used to diff by NAME, so "already correct" and "about to be
  // replaced with something else" printed identically, and --apply POSTed every allow-listed
  // key unconditionally. A live-credential hazard, not a tidiness one: STRIPE_SECRET_KEY must
  // be the LIVE key in the function runtime while `.env` must stay test-mode
  // (.env.example:317-322 — the E2E fixture provisions REAL subscriptions with it). One
  // --apply would push sk_test_ over production and print "8 secret(s) set and verified".
  const { fresh, unchanged, overwrite } = classifySecrets(desired, existing);
  const actionOf = (n: string) =>
    fresh.includes(n)
      ? 'NEW'
      : unchanged.includes(n)
        ? 'UNCHANGED'
        : 'OVERWRITE';

  for (const name of names) {
    console.log(
      `  [${actionOf(name).padEnd(9)}] ${name.padEnd(keyWidth)}  value ${fingerprint(desired[name])}`
    );
  }
  console.log();

  if (overwrite.length > 0) {
    console.log(
      `⚠ ${overwrite.length} secret(s) deployed with a DIFFERENT value: ${overwrite.join(', ')}`
    );
    console.log(
      '  The deployed value may be the correct one — this script cannot read it'
    );
    console.log(
      '  back, only its digest. Re-run with --force if the local value wins.'
    );
    console.log();
  }

  const willWrite = args.force ? [...fresh, ...overwrite] : [...fresh];

  if (!args.apply) {
    console.log(
      `Dry-run — no changes made. --apply would write ${willWrite.length}` +
        `${unchanged.length ? `, skip ${unchanged.length} unchanged` : ''}` +
        `${!args.force && overwrite.length ? `, and REFUSE ${overwrite.length} divergent` : ''}.`
    );
    return;
  }

  if (!args.force && overwrite.length > 0) {
    console.error(
      `✗ Refusing to overwrite ${overwrite.length} divergent secret(s) without --force.`
    );
    process.exit(1);
  }

  if (willWrite.length === 0) {
    console.log(
      '✓ Nothing to do — every secret already matches what is deployed.'
    );
    return;
  }

  console.log(`POSTing ${willWrite.length} secret(s) to Supabase Vault...`);
  await createSecrets(
    projectRef,
    token,
    Object.fromEntries(willWrite.map((n) => [n, desired[n]]))
  );

  // Verify by DIGEST. The old check only asked whether the NAME existed afterwards — which
  // was already true BEFORE the write, so it could report success having changed nothing.
  console.log('Verifying...');
  const after = await listSecretDigests(projectRef, token);
  const wrong = willWrite.filter((n) => after.get(n) !== digest(desired[n]));
  if (wrong.length > 0) {
    console.error(
      `✗ Verification FAILED — deployed digest does not match what we sent: ${wrong.join(', ')}`
    );
    process.exit(1);
  }

  console.log(
    `✓ ${willWrite.length} secret(s) set and verified BY DIGEST in Supabase Vault.`
  );
  console.log('  Edge Functions pick up new secrets on their next cold start.');
}

// Guarded so a test can import from this module without the CLI running. The spawn-based
// permission test invokes this file as argv[1], so it still executes there.
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
