#!/usr/bin/env node
/**
 * Make the built Storybook's own script tags relative, so it works under /storybook/.
 *
 * Use when: after `storybook build`, before storybook-static is copied to /storybook/ by deploy.yml.
 *
 * WHY. Storybook 10's Vite builder writes the module mocker into iframe.html as
 * `<script type="module" src="/vite-inject-mocker-entry.js">`, with a leading slash, while every
 * other asset it writes is relative (`./assets/...`). Production serves Storybook at
 * scripthammer.com/storybook/, so the browser asked for scripthammer.com/vite-inject-mocker-entry.js,
 * got the site's 404 page as text/html, and Safari refused the module. Clicking any story then
 * showed "Importing a module script failed" in place of the component (measured live 14 Nov 2026:
 * the root path answered 404, /storybook/vite-inject-mocker-entry.js answered 200 as JavaScript, and
 * all 287 story chunks reachable from the iframe answered 200). The mocker file itself imports
 * "./assets/preload-helper-*.js", so it only works from the Storybook folder anyway.
 *
 * The rewrite is limited to files the build itself emitted at the top of storybook-static: a
 * root-absolute `src="/x.js"` whose file x.js exists next to iframe.html. Anything else is left
 * alone. It exits 1 if, after the rewrite, iframe.html still loads a root-absolute script, so a
 * future builder change that adds another one fails the build instead of the live site.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_SRC = /(<script\b[^>]*\bsrc=")\/([^"/][^"]*)(")/g;

/** Rewrite root-absolute script srcs that name a file present in `dir`. */
export function relativise(html, exists) {
  const changed = [];
  const out = html.replace(SCRIPT_SRC, (whole, pre, file, post) => {
    if (!exists(file)) return whole;
    changed.push(file);
    return `${pre}./${file}${post}`;
  });
  return { html: out, changed };
}

/** Root-absolute script srcs still left in the page. */
export function rootScripts(html) {
  return [...html.matchAll(SCRIPT_SRC)].map((m) => '/' + m[2]);
}

function main() {
  const dir = resolve(process.argv[2] || 'storybook-static');
  const file = join(dir, 'iframe.html');
  if (!existsSync(file)) {
    console.error(
      `fix-storybook-root-paths: ${file} not found; did storybook build run?`
    );
    process.exit(1);
  }
  const { html, changed } = relativise(readFileSync(file, 'utf8'), (f) =>
    existsSync(join(dir, f))
  );
  writeFileSync(file, html);
  for (const f of changed)
    console.log(`fix-storybook-root-paths: /${f} -> ./${f}`);
  const left = rootScripts(html);
  if (left.length) {
    console.error(
      `fix-storybook-root-paths: iframe.html still loads from the site root: ${left.join(', ')}`
    );
    process.exit(1);
  }
  console.log(
    'fix-storybook-root-paths: iframe.html loads every script relative to /storybook/'
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
