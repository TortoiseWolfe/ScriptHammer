#!/usr/bin/env node
/**
 * Switch the active .env between LOCAL Supabase (Docker sandbox) and CLOUD.
 *
 *   node scripts/switch-env.js local   → overlay .env.local-supabase onto .env
 *   node scripts/switch-env.js cloud   → restore .env from .env.cloud
 *
 * Design (see issue #121):
 *  - `.env.cloud` is a gitignored, full-file backup of your REAL cloud creds.
 *    It is created ONCE, on the first `local` switch, by copying the current
 *    `.env` (which holds cloud) before anything is overwritten. It is the
 *    durable source of truth for restoring cloud — never clobbered.
 *  - `.env.local-supabase` is a COMMITTED fragment of demo/local backend vars.
 *    Switching to local OVERLAYS those keys onto your current `.env`, so
 *    machine-specific vars (GH_TOKEN, git identity, author info, UID/GID) are
 *    preserved across switches.
 *  - Switching back to cloud restores the exact bytes from `.env.cloud`.
 *
 * No secrets are read or printed. Pure file I/O.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV = path.join(ROOT, '.env');
const ENV_CLOUD = path.join(ROOT, '.env.cloud');
const ENV_LOCAL = path.join(ROOT, '.env.local-supabase');

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/**
 * Parse a dotenv file into an ordered list of lines, classifying each as a
 * KEY=value assignment or a passthrough (comment/blank). Preserves order and
 * formatting so an overlaid file stays human-readable.
 */
function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n');
}

/** Extract the set of KEY names assigned in a dotenv file. */
function keysOf(lines) {
  const keys = new Set();
  for (const line of lines) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (m) keys.add(m[1]);
  }
  return keys;
}

/**
 * Overlay `fragment` lines onto `base` lines: for every KEY assigned in the
 * fragment, replace the base's assignment in place (or append if absent).
 * Non-assignment lines in the fragment (its header comments) are NOT copied —
 * only the key/value assignments are applied.
 */
function overlay(baseLines, fragmentLines) {
  const fragMap = new Map();
  for (const line of fragmentLines) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (m) fragMap.set(m[1], line);
  }

  const seen = new Set();
  const out = baseLines.map((line) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (m && fragMap.has(m[1])) {
      seen.add(m[1]);
      return fragMap.get(m[1]);
    }
    return line;
  });

  // Append any fragment keys not already present in base (e.g. SUPABASE_ADMIN_URL).
  const appended = [];
  for (const [key, line] of fragMap) {
    if (!seen.has(key)) appended.push(line);
  }
  if (appended.length) {
    if (out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push('# --- added by `pnpm run use:local` (issue #121) ---');
    out.push(...appended);
  }
  return out;
}

function switchToLocal() {
  if (!fs.existsSync(ENV)) die('.env not found — nothing to switch.');
  if (!fs.existsSync(ENV_LOCAL)) die('.env.local-supabase not found.');

  // First-ever local switch: snapshot the current (cloud) .env as the backup.
  if (!fs.existsSync(ENV_CLOUD)) {
    fs.copyFileSync(ENV, ENV_CLOUD);
    console.log(
      '✓ Backed up current .env → .env.cloud (your real cloud creds).'
    );
  } else {
    console.log(
      '• .env.cloud already exists — leaving your cloud backup untouched.'
    );
  }

  const merged = overlay(readLines(ENV), readLines(ENV_LOCAL));
  fs.writeFileSync(ENV, merged.join('\n'));
  console.log('✓ .env now points at LOCAL Supabase (http://localhost:54321).');
  console.log(
    '  Machine vars (GH_TOKEN, git identity, author info) preserved.'
  );
  console.log('  Run `pnpm run use:cloud` to restore cloud.');
}

function switchToCloud() {
  if (!fs.existsSync(ENV_CLOUD)) {
    die(
      '.env.cloud not found — no cloud backup to restore. ' +
        'Your cloud creds are only captured on the first `use:local`. ' +
        'If you have never switched to local, your .env already holds cloud.'
    );
  }
  fs.copyFileSync(ENV_CLOUD, ENV);
  console.log('✓ .env restored from .env.cloud (your real cloud config).');
}

const target = process.argv[2];
if (target === 'local') switchToLocal();
else if (target === 'cloud') switchToCloud();
else die('Usage: node scripts/switch-env.js <local|cloud>');
