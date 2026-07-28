/**
 * Every theme the site offers, in picker order.
 *
 * Before #408 this list existed three times — the `themes:` block in
 * `globals.css` and a file-local `const` in both `ThemeSwitcher` and
 * `GlobalNav`. All three agreed, but nothing made them agree: adding a theme
 * meant editing three places, and the only symptom of missing one would have
 * been a theme that renders but never appears in a picker.
 *
 * The landing page held a fourth copy of the fact — a hard-coded `32` — and
 * that is the one that drifted, which is why this file exists.
 *
 * `globals.css` is the one copy TypeScript cannot import, so `themes.test.ts`
 * asserts this list still matches it.
 */
export const THEMES = [
  'scripthammer-dark',
  'scripthammer-light',
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
] as const;

export type Theme = (typeof THEMES)[number];

/** Derived, so the number on the landing page cannot disagree with the list. */
export const THEME_COUNT = THEMES.length;
