/**
 * Which files an Edge Function deploy must carry (#1188).
 *
 * WHY THIS EXISTS. Deploying an Edge Function means uploading its entrypoint AND every module
 * it reaches through a relative import. Get the set wrong and the deploy is refused — the
 * Management API validates closure COMPLETENESS, so it will not ship you something that cannot
 * load. What it never validates is PROVENANCE, which is the sharper half of #1188.
 *
 * This was counted by hand on 2026-09-23 while deploying `stripe-webhook` for #1229, and the
 * hand count was WRONG: four files instead of five. The missed one was
 * `_shared/webhook-types.ts`, imported across a line break:
 *
 *     import type {
 *       ...
 *     } from '../_shared/webhook-types.ts';
 *
 * A regex anchored to the `import` keyword cannot see that, and three such imports exist today
 * (`stripe-webhook/index.ts:13`, `create-order/index.ts:35` and `:46`). So this matches the
 * SPECIFIER, never the keyword — the distinction is the entire bug.
 *
 * DEPENDENCY-FREE AND I/O-FREE, DELIBERATELY. The reader is injected, so the identical function
 * runs over `git show <ref>:<path>` and over the working tree. That injection is what makes
 * "stage from a git ref, not from whatever happens to be checked out" a property of the code
 * rather than a sentence in a runbook — and a stale-but-complete tree deploying silently is
 * exactly what #1188 is about.
 */

/** Reads a path relative to `supabase/functions/`, or returns null when it does not exist. */
export type ReadFn = (path: string) => string | null;

/** Normalise `a/b/../c` without importing `node:path`, so this stays runtime-agnostic. */
function normalize(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

/**
 * Every RELATIVE specifier in a source file.
 *
 * Matches `from '…'` wherever it appears, which covers `import x from`, `import type {…}\n}
 * from`, `export … from` and dynamic `import('…')`. Remote specifiers (`https:`, `npm:`,
 * `jsr:`, bare names) are deliberately ignored: Deno fetches those itself and they are not part
 * of the upload.
 */
export function relativeSpecifiers(source: string): string[] {
  const found = new Set<string>();
  // `import x from '…'`, `import type {…}\n} from '…'`, `export … from '…'`.
  for (const m of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g))
    found.add(m[1]);
  // Dynamic `import('…')`.
  for (const m of source.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g))
    found.add(m[1]);
  // SIDE-EFFECT `import './x.ts';` — no `from` at all, so the clause above cannot see it.
  // Caught by this module's own test rather than by review: a side-effect import dropped
  // from the upload is a file the deploy needs and does not carry.
  for (const m of source.matchAll(/import\s+['"](\.[^'"]+)['"]/g))
    found.add(m[1]);
  return [...found];
}

export interface ClosureResult {
  /** Paths relative to `supabase/functions/`, sorted, entrypoint included. */
  files: string[];
  /** Specifiers that could not be read — a deploy built from this would be refused. */
  missing: string[];
}

/**
 * Breadth-first closure from `<slug>/index.ts`.
 *
 * Returns `missing` rather than throwing, because the caller (a dry-run planner) wants to
 * REPORT an incomplete closure, not crash on it — and because "which file is absent" is the
 * question a human actually has when a deploy is refused.
 */
export function resolveClosure(read: ReadFn, slug: string): ClosureResult {
  const entry = `${slug}/index.ts`;
  const files = new Set<string>();
  const missing = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (files.has(current) || missing.has(current)) continue;
    const src = read(current);
    if (src === null) {
      missing.add(current);
      continue;
    }
    files.add(current);
    const base = dirname(current);
    for (const spec of relativeSpecifiers(src)) {
      const dep = normalize(`${base}/${spec}`);
      if (!files.has(dep)) queue.push(dep);
    }
  }

  return { files: [...files].sort(), missing: [...missing].sort() };
}
