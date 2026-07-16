#!/usr/bin/env node
// Parse-check every emitted JS chunk the way the BROWSER will (#294).
//
// The gap this closes: webpack can emit a chunk that is valid to webpack/terser
// but that the browser refuses to PARSE — e.g. an inlined WASM binary rendered
// as a template literal `\0asm...`, whose raw bytes contain octal escapes that
// are illegal in template strings. Such a chunk sails past lint, type-check,
// unit tests, AND `next build` (all of which succeeded), then fails silently at
// browser parse time — killing client-side hydration on EVERY route. That is
// exactly how the atlas merge blanked /chatt, /wireframes and the sign-up form
// on prod for hours (#294).
//
// Webpack chunks load as CLASSIC scripts (<script src>, not type=module), so we
// parse each as a classic script with vm.Script — parse only, never execute —
// which throws the same SyntaxError the browser would. `node --check` per file
// is equivalent but far slower (a process per chunk); this runs in-process.
//
// Usage: node scripts/check-chunks-parse.mjs [dir]   (default: out/_next/static/chunks)

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.argv[2] || 'out/_next/static/chunks';

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // missing dir handled by the caller
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(root);
if (files.length === 0) {
  console.error(
    `check-chunks-parse: no .js chunks under ${root} — did the build/export run first?`
  );
  process.exit(1);
}

const broken = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  try {
    // Parse only. vm.Script compiles (parses) without running; a parse error
    // throws here exactly as the browser's parser would reject the <script>.
    new vm.Script(src, { filename: f });
  } catch (e) {
    broken.push({ f, msg: String(e.message).split('\n')[0] });
  }
}

if (broken.length) {
  console.error(
    `\n❌ ${broken.length} chunk(s) the browser cannot parse (client JS would be dead — #294):`
  );
  for (const b of broken) console.error(`   ${b.f}\n     → ${b.msg}`);
  console.error(
    '\nThese passed lint/type-check/build but fail at browser parse time. Do NOT deploy.'
  );
  process.exit(1);
}

console.log(`✅ all ${files.length} JS chunks parse as classic scripts`);
