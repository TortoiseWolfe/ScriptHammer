/**
 * Write `src/config/theme-contrast.ts` from the computed verdicts (#422).
 *
 * WHY THE DATA IS COMMITTED RATHER THAN GENERATED INTO THE BUILD. CLAUDE.md is explicit:
 * *"Generated artifacts are build OUTPUTS, never inputs. Importing one type-checks
 * locally and fails CI on a fresh checkout."* `/themes` needs to import these verdicts,
 * so they cannot be a build product.
 *
 * The precedent for the shape is `public/manifest.json` and `public/robots.txt`: tracked
 * on purpose, made safe by a test that regenerates and compares. Here that test is
 * `scripts/__tests__/theme-contrast-is-current.test.js`, and it is what turns "a number
 * somebody committed once" into "a number that goes red when a theme changes".
 *
 * Usage:  node scripts/theme-contrast/generate.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeVerdicts } from './compute.mjs';

const WRAPPER = `/**
 * Per-theme WCAG verdicts (#422). The DATA lives in \`theme-contrast.json\`; this file
 * only gives it a type. Do not edit either by hand — regenerate with:
 *
 *     docker compose exec scripthammer node scripts/theme-contrast/generate.mjs
 *
 * WHY THE JSON IS TRACKED. \`/themes\` renders a badge per theme from it, and a build
 * product cannot be imported (CLAUDE.md: generated artifacts are outputs, never inputs).
 * \`scripts/__tests__/theme-contrast-is-current.test.js\` recomputes and fails if it
 * drifts — the same arrangement that makes \`public/manifest.json\` safe to track.
 *
 * WHAT \`level\` CLAIMS: the worst contrast among \`base-content\` on
 * \`base-100\`/\`base-200\`/\`base-300\` — body text on the surfaces text actually sits on —
 * judged at WCAG 4.5 (AA) and 7 (AAA).
 *
 * WHAT IT DOES NOT: a whole-page audit. A theme can pass here and still place text on a
 * surface no token describes. \`color-contrast.spec.ts\` is still the only whole-page
 * sweep, and only for the house themes.
 *
 * \`uiRatio\` is the worst semantic pair (\`primary-content on primary\` and friends),
 * which are UI/large text judged at 3:1 — the threshold
 * \`embed-theme-contrast.spec.ts\` already applies to those same pairs. Reported, and
 * deliberately NOT folded into \`level\`: judging a button label at 4.5 would report most
 * of DaisyUI as failing a standard it does not fail.
 */
import data from './theme-contrast.json';

export interface ThemeContrastVerdict {
  /** The \`data-theme\` value. */
  theme: string;
  /** Body-text verdict. Only this may drive a badge. */
  level: 'AAA' | 'AA' | 'fails' | 'unknown';
  /** Worst body-text ratio, and the pair that produced it. */
  textRatio: number | null;
  textPair: string | null;
  /** Worst semantic (UI/large-text) ratio, judged at 3:1. */
  uiRatio: number | null;
  uiPair: string | null;
  uiMeetsAA: boolean | null;
  /** Pairs that could not be measured. Never treated as passing. */
  skipped: string[];
}

export const THEME_CONTRAST = data as ThemeContrastVerdict[];
`;

const DATA = join(process.cwd(), 'src/config/theme-contrast.json');
const TYPES = join(process.cwd(), 'src/config/theme-contrast.ts');

const verdicts = computeVerdicts();

/**
 * DATA AS JSON, TYPES AS TS — and the split is not cosmetic.
 *
 * The first version emitted one `.ts` file holding a JSON literal, and lint-staged's
 * prettier pass then unquoted every key on commit, so the drift guard's `JSON.parse`
 * failed on the repo's own formatting. Real JSON survives prettier unchanged, and the
 * guard parses the same bytes the app imports.
 */
writeFileSync(DATA, JSON.stringify(verdicts, null, 2) + '\n', 'utf8');
writeFileSync(TYPES, WRAPPER, 'utf8');

const tally = verdicts.reduce((acc, v) => {
  acc[v.level] = (acc[v.level] ?? 0) + 1;
  return acc;
}, {});
console.log(`wrote ${DATA}`);
console.log(
  `  ${verdicts.length} themes — ` +
    Object.entries(tally)
      .map(([k, n]) => `${k}: ${n}`)
      .join(', ')
);
