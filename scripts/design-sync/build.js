#!/usr/bin/env node
/**
 * build.js — one-command builder for the ScriptHammer design-sync bundle.
 *
 * Runs the full pipeline into an output dir:
 *   1. gen-cards --classes   → classes.txt (safelist)
 *   2. gen-theme             → theme.css   (scoped DaisyUI + both brand themes)
 *   3. gen-cards             → token + component preview cards (@dsCard HTML)
 *
 * MUST run inside the scripthammer container (needs @tailwindcss/postcss + DaisyUI):
 *
 *   docker compose exec -w /app scripthammer node scripts/design-sync/build.js
 *
 * Output defaults to /tmp/ds-bundle inside the container (NOT the repo — the
 * cards + theme.css are build artifacts, not source). Override with DS_OUT:
 *
 *   DS_OUT=/tmp/my-bundle docker compose exec -w /app scripthammer \
 *     node scripts/design-sync/build.js
 *
 * Then, from the host, push to claude.ai with Claude Code's /design-sync
 * (copy the bundle out of the container first, or point DS_OUT at a bind mount).
 * See scripts/design-sync/README.md.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = process.env.DS_OUT || '/tmp/ds-bundle';
const SCRIPTS = __dirname;

fs.mkdirSync(OUT, { recursive: true });

function run(label, args) {
  process.stdout.write(`\n▶ ${label}\n`);
  execFileSync('node', args, {
    stdio: 'inherit',
    env: { ...process.env, DS_OUT: OUT },
  });
}

run('1/3 extract class safelist', [
  path.join(SCRIPTS, 'gen-cards.js'),
  '--classes',
]);
run('2/3 compile theme.css', [path.join(SCRIPTS, 'gen-theme.js')]);
run('3/3 emit preview cards', [path.join(SCRIPTS, 'gen-cards.js')]);

const cards = [];
for (const sub of ['tokens', 'components']) {
  const dir = path.join(OUT, sub);
  if (!fs.existsSync(dir)) continue;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) cards.push(path.relative(OUT, p));
    }
  };
  walk(dir);
}

process.stdout.write(
  `\n✓ bundle ready in ${OUT}\n  theme.css + ${cards.length} cards:\n` +
    cards
      .sort()
      .map((c) => `    ${c}`)
      .join('\n') +
    '\n'
);
