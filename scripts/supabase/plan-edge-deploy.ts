#!/usr/bin/env tsx
/**
 * Plan an Edge Function deploy: resolve the closure, and refuse a stale tree (#1188).
 *
 * WHAT THIS IS NOT. It does not deploy. There is no `--apply`, deliberately — uploading to a
 * live Edge Function is a production write on the money path, and the piece that decides
 * `verify_jwt` per slug does not exist anywhere in this repo (`git grep verify_jwt` returns
 * nothing). That boolean lives in an operator's head; guessing it wrong either 401s a live
 * provider or strips the platform JWT gate off a money endpoint. So the upload stays a
 * deliberate human act until someone writes that table down.
 *
 * WHAT IT FIXES. Two failures, both observed on 2026-09-23 while deploying `stripe-webhook`
 * for #1229:
 *
 *   INCOMPLETE CLOSURE. The file set was counted by hand as four; it is five. The Management
 *   API refused the upload, which is the good news — it validates completeness. The bad news
 *   is that the count was a human reading import lines, and one of them hid behind a line
 *   break.
 *
 *   STALE PROVENANCE. The API does NOT validate where the bytes came from. A checkout one
 *   commit behind `origin/main` deploys happily — and at that moment this very worktree was
 *   behind, so a working-tree deploy would have shipped #1229's importer WITHOUT the
 *   `resolve.ts` it imports. That is #1180's failure mode reproducing itself in a clean
 *   checkout.
 *
 * So the plan is always built from a git REF, and the tree is compared against it.
 *
 * Usage:
 *   pnpm supabase:plan-edge --slug stripe-webhook              # plan against origin/main
 *   pnpm supabase:plan-edge --slug create-order --ref HEAD
 *   pnpm supabase:plan-edge --all
 *
 * Exits non-zero when the closure is incomplete, or when the working tree differs from the ref
 * for a file the deploy would carry.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveClosure } from '../lib/edge-function-closure';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
const FUNCTIONS = join(ROOT, 'supabase', 'functions');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** Read a path relative to supabase/functions/ out of a git ref. */
function readFromRef(ref: string) {
  return (p: string): string | null => {
    const r = execFileSync('git', ['show', `${ref}:supabase/functions/${p}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    return r;
  };
}

/** Same, but returning null instead of throwing when the object is absent. */
function safeRefReader(ref: string) {
  const inner = readFromRef(ref);
  return (p: string): string | null => {
    try {
      return inner(p);
    } catch {
      return null;
    }
  };
}

function readFromDisk(p: string): string | null {
  const full = join(FUNCTIONS, p);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

function plan(slug: string, ref: string): boolean {
  const read = safeRefReader(ref);
  const { files, missing } = resolveClosure(read, slug);

  console.log(`\n${slug}  (from ${ref})`);
  if (missing.length > 0) {
    for (const m of missing) console.log(`  MISSING  ${m}`);
    console.error(
      `::error::${slug}: ${missing.length} unresolvable import(s). A deploy built from this ` +
        `would be refused — the API validates closure completeness.`
    );
    return false;
  }

  let drift = 0;
  for (const f of files) {
    const inRef = read(f);
    const onDisk = readFromDisk(f);
    const same = inRef === onDisk;
    if (!same) drift += 1;
    console.log(`  ${same ? 'ok  ' : 'DRIFT'}  ${f}`);
  }

  if (drift > 0) {
    console.error(
      `::error::${slug}: ${drift} file(s) differ between the working tree and ${ref}. ` +
        `Deploying from here ships something no commit describes — which is how a checkout ` +
        `one commit behind would have shipped #1229's importer without its resolve.ts (#1188).`
    );
    return false;
  }

  console.log(`  ${files.length} file(s), tree matches ${ref}`);
  return true;
}

function main(): void {
  const ref = arg('ref') ?? 'origin/main';
  const slug = arg('slug');
  const all = process.argv.includes('--all');

  if (!slug && !all) {
    console.error(
      'usage: plan-edge-deploy.ts --slug <name> [--ref <git-ref>] | --all'
    );
    process.exit(2);
  }
  if (process.argv.includes('--apply')) {
    // Stated as a refusal rather than an unimplemented flag, so nobody reads its absence as
    // "not wired up yet" and adds it casually.
    console.error(
      '::error::--apply is deliberately not implemented (#1188). Uploading to a live Edge ' +
        'Function is a production write on the money path, and the per-slug verify_jwt table ' +
        'it needs exists nowhere in this repo — guessing it 401s a provider or removes the ' +
        'JWT gate from a money endpoint. Deploy by hand, from a ref this planner approved.'
    );
    process.exit(2);
  }

  const slugs = all
    ? readdirSync(FUNCTIONS, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== '_shared')
        .map((d) => d.name)
        .filter((s) => existsSync(join(FUNCTIONS, s, 'index.ts')))
        .sort()
    : [slug as string];

  let bad = 0;
  for (const s of slugs) if (!plan(s, ref)) bad += 1;

  console.log(
    `\n${slugs.length - bad}/${slugs.length} function(s) deployable from ${ref} as checked out.`
  );
  process.exit(bad > 0 ? 1 : 0);
}

main();
