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

const OUT = join(process.cwd(), 'out');

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
  console.error(`strip-css-script-tags: no out/ directory at ${OUT} — skipping.`);
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
