/**
 * Per-theme WCAG verdicts for every DaisyUI theme this app ships (#422).
 *
 * WHAT A BADGE ON `/themes` IS ALLOWED TO CLAIM. #422 refused to render badges from
 * nothing: *"A badge reading 'AAA ✓' beside a theme nobody measured at AAA is the #287
 * failure mode."* Two guards already exist and neither backs the sentence a plate badge
 * implies:
 *
 *   embed-theme-contrast.spec.ts   all 34 themes, but ONLY the Disqus embed's colours
 *   color-contrast.spec.ts         full axe sweep at AAA, but only the 2 house themes
 *
 * So 32 themes have never had an AAA verdict of any kind. This computes one, over the
 * token pairs a visitor actually reads text on.
 *
 * WHAT THE VERDICT MEANS, stated precisely so the badge cannot overclaim: it is the
 * WORST ratio across the pairs below, computed from the theme's own token values. It is
 * NOT a whole-page audit — a theme can pass here and still place text on a surface no
 * token describes. `color-contrast.spec.ts` remains the only whole-page check, and only
 * for the house pair.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oklchToHex } from './oklch.mjs';

/**
 * The pairs a badge is claiming something about.
 *
 * Body text on the three base surfaces, and each semantic colour against its own
 * `-content` token — which is precisely what DaisyUI guarantees a component will use.
 * The base-200/300 variants are included because #415 and #462 both record the same
 * lesson: a colour verified only against `base-100` fails on `base-200`, and that is
 * where cards, tables and form labels actually sit.
 */
/**
 * BODY TEXT — the pairs a plate badge is actually claiming something about.
 *
 * `base-content` on the three base surfaces is unambiguously normal text at normal
 * weight, so WCAG's 4.5 / 7 thresholds apply directly. The base-200/300 variants are
 * included because #415 and #462 record the same lesson twice: a colour verified only
 * against `base-100` fails on `base-200`, which is where cards, tables and form labels
 * actually sit.
 */
const TEXT_PAIRS = [
  ['base-content', 'base-100'],
  ['base-content', 'base-200'],
  ['base-content', 'base-300'],
];

/**
 * SEMANTIC PAIRS — reported, but deliberately NOT what the badge claims.
 *
 * `primary-content on primary` is a button label: UI text, which WCAG judges at 3:1,
 * and this repo already made that call — `embed-theme-contrast.spec.ts` asserts exactly
 * `3:1` for this pair across every theme, having measured them at ">= 3.64:1".
 *
 * Judging them at 4.5 would report most of DaisyUI as failing AA, which is not what the
 * standard says and would make the badge worse than no badge. They are computed and
 * carried in the data so a regression is visible, but the headline verdict is text.
 */
const UI_PAIRS = [
  ['primary-content', 'primary'],
  ['secondary-content', 'secondary'],
  ['accent-content', 'accent'],
  ['neutral-content', 'neutral'],
  ['info-content', 'info'],
  ['success-content', 'success'],
  ['warning-content', 'warning'],
  ['error-content', 'error'],
];

/** WCAG AA for UI components and large text. */
export const AA_UI = 3;

export const AA = 4.5;
export const AAA = 7;

/** WCAG 2.x relative luminance, from an `#rrggbb` string. */
function luminance(hex) {
  const channels = [1, 3, 5].map(
    (o) => parseInt(hex.slice(o, o + 2), 16) / 255
  );
  const lin = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG 2.x contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Every `[data-theme=NAME]{...}` block, mapped to its `--color-*` tokens.
 *
 * Reads DaisyUI's shipped CSS and this app's own `globals.css`, so the two house themes
 * are measured by the same code path as the other 32 rather than by a special case.
 */
export function readThemes(root = process.cwd()) {
  const themes = new Map();
  const sources = [
    join(root, 'node_modules/daisyui/themes.css'),
    join(root, 'src/app/globals.css'),
  ];

  for (const file of sources) {
    let css;
    try {
      css = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    // DaisyUI ships `[data-theme=light]{...}`; globals.css declares the house themes
    // through `@plugin "daisyui/theme" { name: 'scripthammer-light'; --color-…: … }`.
    // Quotes are OPTIONAL: `[data-theme=x]` and `[data-theme='x']` are the same
    // selector, and PRETTIER REWRITES the bare form into the quoted one. A parser that
    // accepted only the bare form silently ignored a real override in globals.css — the
    // CSS was correct, prettier normalised it, and the regenerated data kept reporting
    // the OLD ratio with no error anywhere (#805).
    for (const m of css.matchAll(
      /\[data-theme=['\"]?([\w-]+)['\"]?\]\s*\{([^}]*)\}/g
    )) {
      addTokens(themes, m[1], m[2]);
    }
    for (const m of css.matchAll(/@plugin\s+"daisyui\/theme"\s*\{([^}]*)\}/g)) {
      const body = m[1];
      const name = /name:\s*['"]([\w-]+)['"]/.exec(body)?.[1];
      if (name) addTokens(themes, name, body);
    }
  }
  return themes;
}

/**
 * BOTH NOTATIONS, because this repo uses both.
 *
 * DaisyUI ships `oklch()`. `scripthammer-forge` is authored in HEX, straight from the
 * design's drawn values. An oklch-only parser skipped it silently and reported it as
 * "unknown" — a theme a visitor can select, with no verdict, and nothing saying so.
 * That is the exact shape of failure #422 is about, produced by the tool meant to
 * prevent it.
 */
function addTokens(themes, name, body) {
  const tokens = themes.get(name) ?? {};
  for (const t of body.matchAll(
    /--color-([\w-]+)\s*:\s*(oklch\([^)]*\)|#[0-9a-fA-F]{3,8})/g
  )) {
    const raw = t[2];
    const hex = raw.startsWith('#') ? normaliseHex(raw) : oklchToHex(raw);
    if (hex) tokens[t[1]] = hex;
  }
  if (Object.keys(tokens).length) themes.set(name, tokens);
}

/** `#abc` / `#aabbccdd` -> `#aabbcc`. Alpha is dropped; see the note in oklch.mjs. */
function normaliseHex(hex) {
  const h = hex.slice(1);
  if (h.length === 3)
    return `#${[...h].map((c) => c + c).join('')}`.toLowerCase();
  if (h.length >= 6) return `#${h.slice(0, 6)}`.toLowerCase();
  return null;
}

/**
 * A verdict per theme: the worst pair, and the level that worst pair reaches.
 *
 * Pairs whose tokens a theme does not define are SKIPPED and reported, not treated as
 * passing. A missing token is unknown, and "unknown" must never render as a badge —
 * that is the whole point of #422.
 */
/**
 * The themes this app actually enables, in `globals.css`'s own order.
 *
 * DaisyUI ships more themes than are switched on, and a badge for a theme nobody can
 * select would be measuring something no visitor sees. Read the list rather than
 * restating it, so enabling a theme cannot silently skip its verdict.
 */
export function enabledThemes(root = process.cwd()) {
  const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
  const m = /@plugin\s+"daisyui"\s*\{[^}]*?themes:\s*([^;]+);/s.exec(css);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((t) =>
      t
        .trim()
        .replace(/--default|--prefersdark/g, '')
        .trim()
    )
    .filter(Boolean);
}

/**
 * A verdict per enabled theme.
 *
 * `level` is the BODY TEXT verdict and is the only thing a badge may render. The UI
 * pairs travel alongside it so a regression in a button label is visible in the data
 * and can go red in the guard, without being folded into a claim about readability.
 *
 * A pair whose tokens a theme does not define is SKIPPED and recorded, never treated as
 * passing — "unknown" must not render as a badge, which is the whole point of #422.
 */
export function computeVerdicts(root = process.cwd()) {
  const themes = readThemes(root);
  const out = [];

  for (const name of enabledThemes(root)) {
    const tokens = themes.get(name);
    if (!tokens) {
      out.push({ theme: name, level: 'unknown', reason: 'no tokens found' });
      continue;
    }

    const rate = (pairs) => {
      const measured = [];
      const skipped = [];
      for (const [fg, bg] of pairs) {
        if (!tokens[fg] || !tokens[bg]) {
          skipped.push(`${fg}/${bg}`);
          continue;
        }
        measured.push({
          pair: `${fg} on ${bg}`,
          ratio: Math.round(contrastRatio(tokens[fg], tokens[bg]) * 100) / 100,
        });
      }
      return { measured, skipped };
    };

    const text = rate(TEXT_PAIRS);
    const ui = rate(UI_PAIRS);

    if (!text.measured.length) {
      out.push({
        theme: name,
        level: 'unknown',
        reason: 'no text pairs measurable',
      });
      continue;
    }

    const worstText = text.measured.reduce((a, b) =>
      a.ratio <= b.ratio ? a : b
    );
    const worstUi = ui.measured.length
      ? ui.measured.reduce((a, b) => (a.ratio <= b.ratio ? a : b))
      : null;

    out.push({
      theme: name,
      level:
        worstText.ratio >= AAA ? 'AAA' : worstText.ratio >= AA ? 'AA' : 'fails',
      textRatio: worstText.ratio,
      textPair: worstText.pair,
      uiRatio: worstUi ? worstUi.ratio : null,
      uiPair: worstUi ? worstUi.pair : null,
      uiMeetsAA: worstUi ? worstUi.ratio >= AA_UI : null,
      skipped: [...text.skipped, ...ui.skipped],
    });
  }
  return out;
}
