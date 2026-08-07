#!/usr/bin/env node
/**
 * Post-export fix for a Next.js 15 App-Router static-export bug (#348).
 *
 * The exported HTML emits the SAME stylesheet twice — correctly as
 * `<link rel="stylesheet" href="….css">` AND, wrongly, as
 * `<script src="….css" async>`. The browser fetches the `.css` as a script and
 * throws `SyntaxError: Invalid or unexpected token`, partially breaking the
 * client on every page. The build's sloppy-mode `check-chunks-parse.mjs` never
 * sees it (it only parses JS chunks), so it shipped to prod green — exactly the
 * #287/#288 "deployed product broken while tests pass" class.
 *
 * Fix: strip the bogus `<script src="*.css">` tags from every exported HTML file
 * (the `<link rel="stylesheet">` for the same file is left intact, so styling is
 * unaffected). Wired into `pnpm build` (after `next build`) so CI, deploy, and
 * local builds all get it. Idempotent; logs how many it removed so a future Next
 * upgrade that fixes this upstream shows `0` and this can be retired.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Where the static export actually landed. `next.config.ts` sets
// `distDir: process.env.NEXT_DIST_DIR || '.next'`, and under `output: 'export'`
// on Next 15.5 a CUSTOM distDir receives the export directly — there is no
// `out/` at all. The basePath build (scripts/serve-basepath.sh) does exactly
// that, with NEXT_DIST_DIR=out-basepath.
//
// This previously hard-coded 'out', so on every basePath build it printed
// "no out/ directory — skipping" and exited 0. The #348 fix was therefore never
// applied to the project-site variant that forks deploy: those exports still
// shipped the `<script src="*.css">` tags that make CSS parse as JavaScript.
// A silent skip looked identical to a successful run.
const OUT = join(process.cwd(), process.env.NEXT_DIST_DIR || 'out');

// A <script> whose src ends in `.css` (with its optional empty close tag).
const CSS_SCRIPT = /<script\b[^>]*\bsrc=["'][^"']*\.css["'][^>]*>\s*(?:<\/script>)?/gi;

function walkHtml(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files = files.concat(walkHtml(p));
    else if (entry.endsWith('.html')) files.push(p);
  }
  return files;
}

let htmlFiles;
try {
  htmlFiles = walkHtml(OUT);
} catch {
  // Still non-fatal — a non-export build legitimately has nothing to strip —
  // but the message now names the resolved directory and says plainly what was
  // NOT done, because the old wording read like routine noise while the #348
  // fix was silently skipped on every basePath build.
  console.error(
    `strip-css-script-tags: no export directory at ${OUT} — skipping, so the ` +
      `#348 CSS-as-script fix was NOT applied. If this was an export build, ` +
      `NEXT_DIST_DIR is wrong.`
  );
  process.exit(0);
}

let removed = 0;
let touched = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const matches = html.match(CSS_SCRIPT);
  if (matches) {
    writeFileSync(file, html.replace(CSS_SCRIPT, ''));
    removed += matches.length;
    touched++;
  }
}

console.log(
  `✅ strip-css-script-tags (#348): removed ${removed} <script src="*.css"> tag(s) ` +
    `from ${touched}/${htmlFiles.length} HTML file(s).`
);

/**
 * ZERO IS NOW THE EXPECTED RESULT (#625).
 *
 * #348 read this as a Next bug and stripped the tags out of the export. It was
 * ours: `next.config.ts`'s `vendor` cacheGroup matched every module under
 * node_modules with no type filter, so it claimed CSS as well as JS, and webpack
 * emitted `vendor.css` under a chunk name the loader then wrote a `<script>` for.
 * `type: /javascript/` on the cacheGroups fixed the cause, and this script has
 * removed 0 ever since.
 *
 * Which makes a NON-zero count meaningful for the first time: the root cause is
 * back. Stripping still runs first, so production is never shipped broken by this
 * check — but the build then fails loudly instead of printing a number into a log
 * nobody reads. That silent-success mode is exactly how the basePath variant went
 * on shipping the bug (see the skip message above).
 *
 * If a Next upgrade reintroduces this upstream, this failing IS the notification.
 * Set STRIP_CSS_ALLOW_REMOVALS=1 to ship anyway while you investigate.
 */
if (removed > 0 && process.env.STRIP_CSS_ALLOW_REMOVALS !== '1') {
  console.error(
    `\n✗ Expected 0 removals. ${removed} means the #625 root cause has regressed —\n` +
      `  a splitChunks cacheGroup in next.config.ts is claiming CSS modules again\n` +
      `  (check that each group still carries \`type: /javascript/\`), or Next has\n` +
      `  reintroduced the bug upstream.\n` +
      `  The tags WERE stripped, so this export is safe to serve.\n` +
      `  Override with STRIP_CSS_ALLOW_REMOVALS=1 if you need to ship first.`
  );
  process.exit(1);
}
