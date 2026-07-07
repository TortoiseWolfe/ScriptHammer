#!/usr/bin/env node
/**
 * gen-cards.js — emit the design-sync preview cards.
 *
 * Node stdlib only. Driven by manifest.js. Two modes:
 *
 *   node gen-cards.js --classes   -> write classes.txt (every class used by the
 *                                    cards) so gen-theme.js can safelist them.
 *                                    Run this FIRST, then gen-theme.js.
 *   node gen-cards.js             -> emit token and component card HTML files
 *                                    with theme.css inlined and the @dsCard marker.
 *                                    Run this AFTER theme.css exists.
 *
 * Each card:
 *   - line 1 is <!-- @dsCard group="..." --> (compiled into _ds_manifest.json)
 *   - inlines theme.css in a <style> (fully self-contained)
 *   - renders the component twice, side by side: scripthammer-dark + scripthammer-light
 */
const fs = require('fs');
const path = require('path');
const M = require('./manifest');

// Output dir: DS_OUT env wins (the runner points this at a build dir outside the
// repo scripts), else alongside this script.
const DIR = process.env.DS_OUT || __dirname;
const all = [...M.tokens, ...M.components];

// --- class extraction (for the safelist) ---
function extractClasses() {
  const set = new Set();
  // wrappers + structural classes the generator itself emits
  [
    'bg-base-100',
    'bg-base-200',
    'bg-base-300',
    'text-base-content',
    'p-4',
    'p-6',
    'flex',
    'flex-col',
    'flex-wrap',
    'gap-1',
    'gap-2',
    'gap-3',
    'gap-4',
    'gap-10',
    'items-center',
    'items-baseline',
    'items-end',
    'justify-center',
    'justify-end',
    'pt-2',
    'pt-8',
    'w-16',
    'w-20',
    'w-28',
    'w-64',
    'h-12',
    'h-16',
    'inline-block',
    'shrink-0',
    'grid',
    'grid-cols-2',
    'sm:grid-cols-4',
    'overflow-hidden',
    'border',
    'border-base-300',
    'border-base-content',
    'rounded',
    'rounded-box',
    'rounded-field',
    'rounded-selector',
  ].forEach((c) => set.add(c));

  // harvest from rendered markup
  const fakeH = { esc: (s) => s };
  for (const item of all) {
    const html = item.render(fakeH);
    const re = /class="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      m[1].split(/\s+/).forEach((c) => c && set.add(c));
    }
  }
  return [...set].sort();
}

function pageWrap(group, title, themeCss, innerDark, innerLight) {
  return `<!-- @dsCard group="${group}" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ScriptHammer — ${title}</title>
<style>
${themeCss}
.ds-frame { display:flex; flex-wrap:wrap; gap:1.5rem; padding:1.5rem; }
.ds-pane { flex:1 1 360px; min-width:320px; border-radius:1rem; }
.ds-label { font:600 11px/1.4 ui-sans-serif,system-ui,sans-serif; letter-spacing:.04em; text-transform:uppercase; opacity:.6; margin-bottom:.5rem; }
</style>
</head>
<body>
<div class="ds-frame">
  <div class="ds-pane" data-theme="scripthammer-dark">
    <div class="bg-base-100 text-base-content rounded-box p-6">
      <div class="ds-label text-base-content">scripthammer-dark</div>
      ${innerDark}
    </div>
  </div>
  <div class="ds-pane" data-theme="scripthammer-light">
    <div class="bg-base-100 text-base-content rounded-box p-6">
      <div class="ds-label text-base-content">scripthammer-light</div>
      ${innerLight}
    </div>
  </div>
</div>
</body>
</html>
`;
}

function emitCards() {
  const themeCssPath = path.join(DIR, 'theme.css');
  if (!fs.existsSync(themeCssPath)) {
    console.error('theme.css not found — run gen-theme.js first.');
    process.exit(1);
  }
  const themeCss = fs.readFileSync(themeCssPath, 'utf8');
  const fakeH = { esc: (s) => s };

  let count = 0;
  for (const t of M.tokens) {
    const inner = t.render(fakeH);
    const html = pageWrap(t.group, t.title, themeCss, inner, inner);
    const dest = path.join(DIR, 'tokens', `${t.slug}.html`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
    count++;
  }
  for (const c of M.components) {
    const inner = c.render(fakeH);
    const html = pageWrap(c.group, c.title, themeCss, inner, inner);
    const dest = path.join(DIR, 'components', c.slug, 'index.html');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
    count++;
  }
  console.log(
    `emitted ${count} cards (inlined theme.css ${(Buffer.byteLength(themeCss) / 1024).toFixed(1)} KB each)`
  );
}

const mode = process.argv[2];
if (mode === '--classes') {
  const classes = extractClasses();
  fs.writeFileSync(path.join(DIR, 'classes.txt'), classes.join('\n') + '\n');
  console.log(`classes.txt written: ${classes.length} classes`);
} else {
  emitCards();
}
