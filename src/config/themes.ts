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
  'scripthammer-forge',
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

/**
 * The split, also derived (#514).
 *
 * Prose about this project says "35 themes" in some places and "32 DaisyUI
 * themes" in others, and BOTH are true — 35 total, of which 3 are ours. That
 * is precisely why the numbers drift: a reader checking one against the other
 * finds a mismatch that is not a mismatch, "corrects" it, and makes a true
 * sentence false. Export both so copy can cite whichever it means and neither
 * has to be typed by hand.
 */
export const HOUSE_THEMES = THEMES.filter((t) => t.startsWith('scripthammer-'));

/**
 * The count, derived from the list above rather than typed (#915).
 *
 * It was already derived and therefore already correct. The PROSE beside it was not: it
 * read "34 total, of which 2 are ours" and "the total minus the two we ship" — written when
 * there were two house themes, and left behind when `scripthammer-forge` became the third.
 * A comment in the one module whose stated job is stopping numbers from drifting.
 *
 * `HOUSE_THEMES` exists because six test files each restated the house list by hand instead
 * of importing it, and every one of them missed forge — including `color-contrast.spec.ts`,
 * the AAA gate, whose comment said "Both custom themes covered".
 */
export const HOUSE_THEME_COUNT = HOUSE_THEMES.length;

/** DaisyUI's own themes — the total minus the house themes we ship. */
export const DAISYUI_THEME_COUNT = THEME_COUNT - HOUSE_THEME_COUNT;

/**
 * The themes shown as full swatches on the landing page and `/themes` (#379).
 *
 * The 2a design drew six and named four that do not exist in this repo —
 * `terminal`, `field`, `paper`, `larp` — as proposed new themes, each given
 * only a three-colour accent triplet and no base tokens. The owner's call was
 * to curate ten real ones instead; the proposed palettes are recorded on #379
 * so the intent survives.
 *
 * `scripthammer-dark` leads because it is the site default (`--default` in
 * globals.css) and the theme the whole design is drawn in.
 *
 * ONE list, used by both surfaces. Two hand-maintained copies of these ten is
 * exactly the drift #408 removed — the theme list had reached five copies, one
 * of which silently excluded the default theme from a test.
 */
export const CURATED_THEMES = [
  'scripthammer-dark',
  'scripthammer-light',
  'synthwave',
  'retro',
  'forest',
  'luxury',
  'halloween',
  'aqua',
  'sunset',
  'dim',
] as const satisfies readonly Theme[];
