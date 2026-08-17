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
 *   pnpm supabase:auth-config --check            # dry-run + EXIT 1 on drift (CI gate)
 *   pnpm supabase:auth-config --apply            # PATCH and verify
 *   pnpm supabase:auth-config --config path.json # override config path
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN              — Management API token (from dashboard)
 *   NEXT_PUBLIC_SUPABASE_PROJECT_REF   — short project ref, e.g. "abcd1234"
 *   RESEND_API_KEY                     — becomes smtp_pass when SMTP is configured
 *   TURNSTILE_SECRET_KEY               — becomes security_captcha_secret
 *
 * All are read from the environment, falling back to `.env` (gitignored).
 *
 * SECRET-BEARING FIELDS (#622). `auth-config.json` is committed, so it holds no
 * secrets — but two of the features it declares are broken or dangerous without
 * one, and the Management API takes the secret as a sibling field:
 *
 *   smtp_host, smtp_user, …      need `smtp_pass`
 *   security_captcha_enabled     needs `security_captcha_secret`
 *
 * Before this was handled, `--apply` sent the visible fields and omitted the
 * secrets. That is strictly worse than the drift it "fixes": SMTP with no
 * password sends NOTHING (vs. a working fallback mailer), and CAPTCHA with no
 * secret REJECTS EVERY SIGNUP. On 2026-08-07 the drift check told an operator to
 * run exactly this command against a production project whose SMTP was unset.
 *
 * So: inject each secret from env when present, and when it is absent SKIP that
 * feature's fields entirely rather than half-applying them. A gap you can see
 * beats a config that looks applied and silently does not work.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CommonJS loader shared with the two test suites that read the same file (#734),
// so the pinned desired state and its readers cannot disagree about what it says.
const { loadAuthConfig } = createRequire(import.meta.url)(
  './auth-config-loader.js'
) as {
  loadAuthConfig: (
    path: string,
    env?: NodeJS.ProcessEnv
  ) => Record<string, unknown>;
};

/**
 * Read a var from the environment, falling back to `.env`.
 *
 * Nothing preloads dotenv for this script, so in a normal local shell every
 * secret below would read as absent and silently take the "skip" path. CI passes
 * them as real env vars and takes the first branch.
 */
function envOrDotenv(names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.length > 0) return v;
  }
  let raw = '';
  try {
    raw = readFileSync(resolve(__dirname, '..', '..', '.env'), 'utf8');
  } catch {
    return undefined;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    if (!names.includes(key)) continue;
    const val = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (val) return val;
  }
  return undefined;
}

/**
 * A feature whose declared fields are inert or harmful without a companion
 * secret that the committed config file deliberately does not carry.
 */
type SecretRule = {
  label: string;
  /** the Management API field that carries the secret */
  secretField: string;
  /** env var names to source it from, in priority order */
  envNames: string[];
  /** true when the desired config actually turns this feature on */
  wanted: (desired: AuthConfig) => boolean;
  /** fields to withhold entirely when the secret is missing */
  fields: string[];
  /** what goes wrong if applied without the secret */
  harm: string;
};

const SECRET_RULES: SecretRule[] = [
  {
    label: 'SMTP',
    secretField: 'smtp_pass',
    envNames: ['SUPABASE_SMTP_PASS', 'RESEND_API_KEY'],
    wanted: (d) => typeof d.smtp_host === 'string' && d.smtp_host.length > 0,
    fields: [
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_admin_email',
      'smtp_sender_name',
    ],
    harm: 'a custom SMTP host with no password sends NOTHING — worse than the built-in fallback mailer',
  },
  {
    label: 'CAPTCHA',
    secretField: 'security_captcha_secret',
    // TURNSTILE_SECRET is the name scripts/check-captcha.mjs already uses; keep
    // one name for one secret. Run that script BEFORE enabling — it validates the
    // secret against Cloudflare siteverify and exits non-zero when it is unsafe.
    envNames: ['TURNSTILE_SECRET', 'SUPABASE_AUTH_CAPTCHA_SECRET'],
    wanted: (d) => d.security_captcha_enabled === true,
    fields: ['security_captcha_enabled', 'security_captcha_provider'],
    harm: 'CAPTCHA enabled with no secret REJECTS EVERY SIGNUP',
  },
  // OAuth providers (#725/#732 follow-on). The desired state carries the CLIENT IDs —
  // public values that appear in every authorize URL the browser is redirected to, and
  // exactly what `tests/e2e/utils/oauth-validity.ts` asserts the shape of. The SECRETS are
  // never committed, so the same withhold rule that protects SMTP and CAPTCHA has to cover
  // these or the guard has a hole in the shape of its own purpose.
  //
  // THIS MATTERS MOST FOR FORKS, which is what ScriptHammer is for. On a project that has
  // never had the secret, applying `enabled: true` + a client id turns the provider ON with
  // no secret behind it — every OAuth sign-in then fails at the provider, which is the #287
  // shape (config looks configured, no human can sign in, tests green).
  {
    label: 'GitHub OAuth',
    secretField: 'external_github_secret',
    envNames: ['SUPABASE_AUTH_GITHUB_SECRET', 'GITHUB_OAUTH_SECRET'],
    wanted: (d) => d.external_github_enabled === true,
    fields: ['external_github_enabled', 'external_github_client_id'],
    harm: 'GitHub OAuth enabled with no client secret — every "Sign in with GitHub" fails at GitHub',
  },
  {
    label: 'Google OAuth',
    secretField: 'external_google_secret',
    envNames: ['SUPABASE_AUTH_GOOGLE_SECRET', 'GOOGLE_OAUTH_SECRET'],
    wanted: (d) => d.external_google_enabled === true,
    fields: ['external_google_enabled', 'external_google_client_id'],
    harm: 'Google OAuth enabled with no client secret — every "Sign in with Google" fails at Google',
  },
];

type CliArgs = {
  apply: boolean;
  check: boolean;
  configPath: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    apply: false,
    check: false,
    configPath: resolve(__dirname, 'auth-config.json'),
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') {
      args.apply = true;
    } else if (a === '--check') {
      args.check = true;
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
        'Usage: tsx scripts/supabase/set-auth-config.ts [--check] [--apply] [--config <path>]'
      );
      process.exit(0);
    } else if (a === '--') {
      // npm/pnpm arg separator (`pnpm run <script> -- --flag`) — ignore it.
      continue;
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
    // Through the shared loader so `${VAR:-default}` resolves (#734). The pinned
    // default is what makes drift detectable at all — if the EXPECTED value came
    // from the runner's environment alone, both sides could drift together and this
    // gate could never fire, which is #287 exactly. The interpolation only lets a
    // FORK declare its own expectation without editing a file it is meant to reuse.
    desired = loadAuthConfig(args.configPath, process.env) as AuthConfig;
  } catch (err) {
    console.error(
      `✗ Could not read/parse ${args.configPath}: ${(err as Error).message}`
    );
    process.exit(1);
  }

  console.log(`Project: ${projectRef}`);
  console.log(`Config:  ${args.configPath}`);
  console.log(
    `Mode:    ${args.check ? 'CHECK (fail on drift)' : args.apply ? 'APPLY' : 'dry-run (default)'}`
  );
  console.log();

  console.log('Fetching current auth config...');
  const current = await getAuthConfig(projectRef, token);

  const diff = computeDiff(current, desired);
  printDiff(diff);

  // --check: a read-only CI gate. Non-zero exit on ANY drift so the pipeline
  // fails when the live project has diverged from the checked-in desired state
  // (the #287 class: prod config drifts, tests stay green, sign-up breaks).
  if (args.check) {
    if (diff.length > 0) {
      console.error(
        `\n✗ Drift detected: ${diff.length} field(s) differ from ${args.configPath}. ` +
          'Reconcile with `pnpm supabase:auth-config --apply`.'
      );
      process.exit(1);
    }
    console.log(
      '✓ No drift — the live project matches the checked-in desired config.'
    );
    return;
  }

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

  // Attach each secret, or withhold the whole feature. See SECRET_RULES (#622).
  const withheld = new Set<string>();
  for (const rule of SECRET_RULES) {
    if (!rule.wanted(desired)) continue;
    // Nothing from this feature is being changed — no secret needed.
    if (!rule.fields.some((f) => f in patch)) continue;

    const secret = envOrDotenv(rule.envNames);
    if (secret) {
      patch[rule.secretField] = secret;
      console.log(
        `  ${rule.label}: attaching ${rule.secretField} from ${rule.envNames[0]} (…${secret.slice(-4)})`
      );
    } else {
      for (const f of rule.fields) {
        delete patch[f];
        withheld.add(f);
      }
      console.warn(
        `\n  ⚠ ${rule.label}: WITHHELD — no ${rule.secretField} found in ${rule.envNames.join(' or ')}.\n` +
          `    Applying it anyway would mean: ${rule.harm}.\n` +
          `    Set the secret and re-run; these stay drifted until you do: ${rule.fields.join(', ')}`
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    console.error(
      '\n✗ Every proposed change was withheld for a missing secret. Nothing applied.'
    );
    process.exit(1);
  }

  console.log('Applying PATCH...');
  await patchAuthConfig(projectRef, token, patch);

  console.log('Verifying...');
  const after = await getAuthConfig(projectRef, token);
  // Withheld fields are still drifted BY DESIGN — verifying them would fail on
  // the gap this run deliberately refused to paper over.
  const residual = computeDiff(after, desired).filter(
    (r) => !withheld.has(r.key)
  );
  if (withheld.size > 0) {
    console.warn(
      `\n⚠ ${withheld.size} field(s) left drifted for want of a secret: ${[...withheld].join(', ')}`
    );
  }
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
