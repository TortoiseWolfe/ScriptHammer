#!/usr/bin/env node
/**
 * Decide whether a diff needs `Test (20.x)`'s three expensive steps (#1218).
 *
 * WHY. Coverage, the app build and the Storybook build are ~9 of the ~10 minutes this job
 * takes, and it is the highest-frequency required check in the repo. Measured on #1217,
 * which changed ONE markdown file: coverage 5.7 min, app build 1.7, rebrand harness 1.2,
 * Storybook 0.6. Net cost is $0.00 — a public repo on standard runners is unmetered — so
 * what this buys is queue time and feedback latency, not money.
 *
 * WHY NOT A TRIGGER `paths:` FILTER. `Test (20.x)` is a REQUIRED context, and it is the
 * job itself: there is no always-reporting aggregate to hide behind. A required check that
 * never reports is PENDING FOREVER, not skipped, so a `paths:` filter would make every
 * docs-only PR permanently unmergeable. For the same reason the gate is applied per-STEP
 * and not via `needs:` on a separate job — a skipped job is a check that never reports.
 *
 * WHY THE LIST IS NOT INHERITED FROM `e2e.yml`. The issue suggested deriving it from that
 * workflow's `paths-ignore`. That list contains `docs/**` and `features/**`, and in THIS
 * repo both are build INPUT:
 *
 *   - `src/lib/docs/registry.ts` names 7 markdown files that `/docs/[slug]` renders at
 *     build time. A broken path in one of them fails `pnpm build`, which runs inside this
 *     very job — so skipping the build on a change to them removes their only coverage.
 *   - `prebuild` runs `sync-wireframes.sh`, which turns `features/**` into
 *     `public/wireframes/` for the `/wireframes` route.
 *
 * So the carve-out is PARSED from the registry rather than copied, and it cannot drift
 * when a doc is added to the rail. Inheriting `e2e.yml`'s list would inherit its hole.
 *
 * FAIL-SAFE POLARITY. The caller gates on `docs_only != 'true'`, so anything this cannot
 * decide — an empty output, a crash, an unknown path — runs the full job. The expensive
 * outcome is the safe one.
 *
 * Usage:
 *   node scripts/ci/ci-docs-only.mjs <base-sha> <head-sha>   # writes $GITHUB_OUTPUT
 *   node scripts/ci/ci-docs-only.mjs --files a.md b.ts       # ad hoc, prints the verdict
 *   node scripts/ci/ci-docs-only.mjs --selftest              # pure, no git, no network
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

/**
 * Paths that cannot change what `pnpm build`, `pnpm test:coverage` or
 * `pnpm build-storybook` produce.
 *
 * Deliberately conservative. Anything not listed here is treated as code, because the
 * cost of a wrong "inert" is a green required check over an untested change, while the
 * cost of a wrong "code" is nine minutes.
 */
export const INERT_PATTERNS = [
  /^[^/]*\.md$/, // top-level markdown: README, CLAUDE.md, CHANGELOG …
  /^docs\//, // the docs tree, MINUS the registry carve-out below
  /^\.claude\//,
  /^\.specify\//,
  /^\.vscode\//,
  /^LICENSE$/,
  /^\.gitignore$/,
];

/**
 * Markdown that `/docs/[slug]` renders at build time — NOT inert, despite living under
 * `docs/` and ending in `.md`.
 *
 * Parsed from the registry the same way `repo-links.test.js` does, so adding a doc to the
 * rail automatically protects it here. Throws rather than returning a short list: a silent
 * zero would quietly make every one of these inert, which is the failure this guards.
 */
export function buildInputMarkdown(
  source = fs.readFileSync(
    path.join(ROOT, 'src', 'lib', 'docs', 'registry.ts'),
    'utf8'
  )
) {
  const files = [...source.matchAll(/^\s*file:\s*'([^']+)'/gm)].map(
    (m) => m[1]
  );
  if (files.length < 5) {
    throw new Error(
      `parsed only ${files.length} entries from src/lib/docs/registry.ts — the shape ` +
        'changed. Refusing to continue: a short list would silently mark ' +
        'build-rendered docs as inert and skip the build that is their only coverage.'
    );
  }
  return files;
}

/** Paths whose change means the expensive steps must run. */
export function isDocsOnly(files, rendered = buildInputMarkdown()) {
  if (!Array.isArray(files) || files.length === 0) return false;
  const renderedSet = new Set(rendered);
  return files.every((f) => {
    const p = f.trim();
    if (!p) return false;
    if (renderedSet.has(p)) return false; // rendered at build time
    return INERT_PATTERNS.some((re) => re.test(p));
  });
}

function changedFiles(base, head) {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `${base}...${head}`],
    { cwd: ROOT, encoding: 'utf8' }
  );
  return out.split('\n').filter(Boolean);
}

function selftest() {
  const rendered = [
    'README.md',
    'docs/AUTH-SETUP.md',
    'docs/messaging/QUICKSTART.md',
  ];
  const cases = [];
  const check = (label, got, want) =>
    cases.push([
      label,
      JSON.stringify(got) === JSON.stringify(want),
      got,
      want,
    ]);

  check('CLAUDE.md alone is inert', isDocsOnly(['CLAUDE.md'], rendered), true);
  check(
    'a plain doc is inert',
    isDocsOnly(['docs/notes/x.md'], rendered),
    true
  );
  // The carve-out, in both directions.
  check(
    'a registry-rendered doc is NOT inert',
    isDocsOnly(['docs/AUTH-SETUP.md'], rendered),
    false
  );
  check(
    'README is NOT inert, it is rendered',
    isDocsOnly(['README.md'], rendered),
    false
  );
  // features/** feeds prebuild -> public/wireframes -> the /wireframes route.
  check(
    'a wireframe source is NOT inert',
    isDocsOnly(['features/x/wireframes/a.svg'], rendered),
    false
  );
  check(
    'source is not inert',
    isDocsOnly(['src/app/page.tsx'], rendered),
    false
  );
  check(
    'a mixed diff is not inert',
    isDocsOnly(['CLAUDE.md', 'src/app/page.tsx'], rendered),
    false
  );
  check('an empty diff is not inert', isDocsOnly([], rendered), false);
  check(
    'a workflow change is not inert',
    isDocsOnly(['.github/workflows/ci.yml'], rendered),
    false
  );
  check(
    'a lockfile change is not inert',
    isDocsOnly(['pnpm-lock.yaml'], rendered),
    false
  );
  check(
    '.claude is inert',
    isDocsOnly(['.claude/agents/x.md'], rendered),
    true
  );
  check(
    'the real registry yields at least 7 rendered docs',
    buildInputMarkdown().length >= 7,
    true
  );
  check(
    'a truncated registry throws rather than reporting none',
    (() => {
      try {
        buildInputMarkdown("file: 'only.md'");
        return 'did not throw';
      } catch {
        return 'threw';
      }
    })(),
    'threw'
  );

  let bad = 0;
  for (const [label, ok, got, want] of cases) {
    if (!ok) {
      console.error(
        `  FAILED: ${label}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`
      );
      bad += 1;
    }
  }
  if (bad) process.exit(1);
  console.log(`selftest ok: ${cases.length} cases, no git, no network`);
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();

  const filesFlag = argv.indexOf('--files');
  let files;
  if (filesFlag > -1) {
    files = argv.slice(filesFlag + 1);
  } else {
    const [base, head] = argv;
    if (!base || !head) {
      console.error(
        'usage: ci-docs-only.mjs <base-sha> <head-sha> | --files <paths...> | --selftest'
      );
      process.exit(2);
    }
    files = changedFiles(base, head);
  }

  const verdict = isDocsOnly(files);
  console.log(`changed ${files.length} file(s); docs_only=${verdict}`);
  for (const f of files.slice(0, 40)) console.log(`  ${f}`);
  if (files.length > 40) console.log(`  … and ${files.length - 40} more`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${verdict}\n`);
  }
}

main(process.argv.slice(2));
