#!/usr/bin/env node
/**
 * gen-theme.js — build a scoped DaisyUI theme.css for the design-sync bundle.
 *
 * Produces theme.css containing ONLY the two brand themes
 * (scripthammer-dark + scripthammer-light) plus the brand-polish CSS,
 * compiled through the project's own @tailwindcss/postcss + DaisyUI v5.
 *
 * Run inside the scripthammer container so node_modules is available:
 *   docker compose exec -T scripthammer node /app/<scratchpath>/gen-theme.js
 *
 * Inputs (same dir):
 *   - classes.txt   (safelist of every class the cards use; written by gen-cards.js)
 * Output (same dir):
 *   - theme.css
 *
 * The entry CSS @imports tailwindcss, declares the two brand themes via
 * @plugin "daisyui/theme", and uses @source inline(...) so Tailwind keeps
 * every utility class our static HTML references (there is no JS/TSX content
 * to scan in the bundle).
 */
const fs = require('fs');
const path = require('path');

// pnpm strict layout: `postcss` is not top-level in /app/node_modules. Resolve
// `@tailwindcss/postcss` first (it IS top-level), then resolve `postcss` from
// within that package's own resolution scope.
const tailwindEntry = require.resolve('@tailwindcss/postcss', {
  paths: [process.cwd(), '/app'],
});
const tailwind = require(tailwindEntry);
const postcss = require(
  require.resolve('postcss', { paths: [path.dirname(tailwindEntry)] })
);

const DIR = process.env.DS_OUT || __dirname;
const classesPath = path.join(DIR, 'classes.txt');
const safelist = fs.existsSync(classesPath)
  ? fs
      .readFileSync(classesPath, 'utf8')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// The two brand theme blocks, copied verbatim from src/app/globals.css
// (scripthammer-dark lines 55-94, scripthammer-light lines 97-137) plus the
// brand-polish block (lines 139-180). DaisyUI is enabled WITHOUT the 32 stock
// themes so the bundle stays brand-scoped and small.
const ENTRY = `
@import 'tailwindcss';

/* Keep every class our static preview cards reference. */
@source inline("${safelist.join(' ')}");

@plugin "daisyui" {
  themes: scripthammer-dark --default, scripthammer-light;
}

@plugin "daisyui/theme" {
  name: 'scripthammer-dark';
  default: true;
  color-scheme: dark;
  --color-base-100: oklch(22.84% 0.038 282.93);
  --color-base-200: oklch(21.13% 0.039 282.53);
  --color-base-300: oklch(28.51% 0.067 281.32);
  --color-base-content: oklch(92.88% 0.013 255.51);
  --color-primary: oklch(76.05% 0.024 258.37);
  --color-primary-content: oklch(22.84% 0.038 282.93);
  --color-secondary: oklch(87.91% 0.043 76.31);
  --color-secondary-content: oklch(22.84% 0.038 282.93);
  --color-accent: oklch(75.35% 0.139 232.66);
  --color-accent-content: oklch(22.84% 0.038 282.93);
  --color-neutral: oklch(31.14% 0.052 282.99);
  --color-neutral-content: oklch(87.17% 0.009 258.34);
  --color-info: oklch(73.08% 0.13 260.06);
  --color-info-content: oklch(22.84% 0.038 282.93);
  --color-success: oklch(72.27% 0.192 149.58);
  --color-success-content: oklch(22.84% 0.038 282.93);
  --color-warning: oklch(90.52% 0.166 98.11);
  --color-warning-content: oklch(22.84% 0.038 282.93);
  --color-error: oklch(74.7% 0.132 20.69);
  --color-error-content: oklch(22.84% 0.038 282.93);
  --radius-selector: 0.75rem;
  --radius-field: 0.5rem;
  --radius-box: 1.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 1;
}

@plugin "daisyui/theme" {
  name: 'scripthammer-light';
  default: false;
  prefersdark: false;
  color-scheme: light;
  --color-base-100: oklch(95.76% 0.009 67.72);
  --color-base-200: oklch(92.44% 0.013 75.36);
  --color-base-300: oklch(87.66% 0.016 73.66);
  --color-base-content: oklch(27.81% 0.03 256.85);
  --color-primary: oklch(42.79% 0.03 257.68);
  --color-primary-content: oklch(100% 0 0);
  --color-secondary: oklch(44.28% 0.116 46.14);
  --color-secondary-content: oklch(100% 0 0);
  --color-accent: oklch(42.86% 0.098 239.94);
  --color-accent-content: oklch(100% 0 0);
  --color-neutral: oklch(37.29% 0.031 259.73);
  --color-neutral-content: oklch(98.46% 0.002 247.84);
  --color-info: oklch(43.86% 0.167 262.77);
  --color-info-content: oklch(100% 0 0);
  --color-success: oklch(42.03% 0.11 149.9);
  --color-success-content: oklch(100% 0 0);
  --color-warning: oklch(43.35% 0.09 76.98);
  --color-warning-content: oklch(100% 0 0);
  --color-error: oklch(44.94% 0.164 26.98);
  --color-error-content: oklch(100% 0 0);
  --radius-selector: 0.75rem;
  --radius-field: 0.5rem;
  --radius-box: 1.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 1;
}

/* Brand polish — scoped to the custom themes only (globals.css 139-180). */
[data-theme='scripthammer-dark'] .card,
[data-theme='scripthammer-light'] .card {
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.25),
    0 10px 15px -3px rgb(0 0 0 / 0.2),
    0 20px 25px -5px rgb(0 0 0 / 0.15);
}
[data-theme='scripthammer-dark'] .btn,
[data-theme='scripthammer-light'] .btn {
  box-shadow:
    0 2px 4px 0 rgb(0 0 0 / 0.2),
    0 1px 2px -1px rgb(0 0 0 / 0.15);
}
[data-theme='scripthammer-dark'] .btn:hover,
[data-theme='scripthammer-light'] .btn:hover {
  box-shadow:
    0 4px 8px -1px rgb(0 0 0 / 0.3),
    0 2px 4px -2px rgb(0 0 0 / 0.2);
}
`;

(async () => {
  // from: must point inside the project so DaisyUI's plugin resolves under node_modules.
  const result = await postcss([tailwind()]).process(ENTRY, {
    from: path.join(process.cwd(), 'ds-entry.css'),
  });
  const out = path.join(DIR, 'theme.css');
  fs.writeFileSync(out, result.css);
  const kb = (Buffer.byteLength(result.css) / 1024).toFixed(1);
  const oklch = (result.css.match(/oklch\(/g) || []).length;
  const themes = (result.css.match(/\[data-theme=/g) || []).length;
  console.log(
    `theme.css written: ${kb} KB, ${oklch} oklch() refs, ${themes} data-theme selectors`
  );
  if (oklch === 0) {
    console.error('WARNING: no oklch() in output — theme tokens missing!');
    process.exit(1);
  }
})().catch((e) => {
  console.error('gen-theme failed:', e.message);
  process.exit(1);
});
