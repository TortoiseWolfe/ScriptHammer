'use client';

import { useEffect, useState } from 'react';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import { CURATED_THEMES, THEMES, THEME_COUNT } from '@/config/themes';
import { THEME_CONTRAST } from '@/config/theme-contrast';
import {
  applyTheme,
  readStoredTheme,
  DEFAULT_THEME,
} from '@/utils/apply-theme';

// 3c (#382). Counts are DERIVED — the comp says "six curated / the other 26",
// which is 32 and was already stale when it was drawn. The curated set is ten
// (owner, 2026-07-28) and lives in one place so this page and the home rail
// cannot disagree (#408).
// `CURATED_THEMES` is a literal tuple, so `.includes` narrows its argument to
// those ten; widen for the membership test.
const CURATED: readonly string[] = CURATED_THEMES;

/**
 * The measured contrast verdict for a theme, or null (#422).
 *
 * NULL RENDERS NOTHING, deliberately. The 2a comp draws a badge on every plate, and the
 * badges were held back precisely because a badge nobody measured is the #287 failure —
 * "the label asserts a guarantee the repo cannot back". A theme with no verdict gets no
 * badge rather than a reassuring one.
 */
const VERDICTS = new Map(THEME_CONTRAST.map((v) => [v.theme, v]));

function ContrastBadge({ theme }: { theme: string }) {
  const verdict = VERDICTS.get(theme);
  if (!verdict || verdict.level === 'unknown' || verdict.textRatio === null) {
    return null;
  }

  // Solid tokens, no opacity: this sits on `base-300`, which is the surface where
  // dimmed text fails AAA (#462), and a badge about contrast must clear its own bar.
  const tone =
    verdict.level === 'AAA'
      ? 'bg-success text-success-content'
      : verdict.level === 'AA'
        ? 'bg-warning text-warning-content'
        : 'bg-error text-error-content';

  // The visible text is the level; the full sentence is the accessible name, so the
  // claim travels with the badge instead of living only in this file.
  const label =
    `body text ${verdict.textRatio}:1 (${verdict.textPair}) — ` +
    (verdict.level === 'AAA'
      ? 'meets WCAG AAA'
      : verdict.level === 'AA'
        ? 'meets WCAG AA, below AAA'
        : 'below WCAG AA');

  return (
    <span
      title={label}
      aria-label={label}
      className={`${tone} rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-normal`}
    >
      {verdict.level === 'fails' ? '!AA' : verdict.level}
    </span>
  );
}
const OTHERS = THEMES.filter((t) => !CURATED.includes(t));

/** One theme rendered as its own colours, scoped so it draws itself. */
function ThemePlate({
  theme,
  active,
  onApply,
}: {
  theme: string;
  active: boolean;
  onApply: (t: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onApply(theme)}
      aria-pressed={active}
      // w-full: a `block` button still sizes to its content, so without this the
      // plates were as wide as their labels — SCRIPTHAMMER-DARK far wider than
      // LUXURY — and the grid read as ragged rather than a set.
      className="focus-visible:ring-primary block w-full overflow-hidden rounded-2xl text-left focus-visible:ring-2"
      style={{
        boxShadow: active
          ? '0 22px 42px -16px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.14), 0 0 0 2px var(--color-secondary)'
          : '0 22px 42px -16px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.14)',
      }}
    >
      {/* data-theme is scoped to the SAMPLE only. Scoping the label too made it
          inherit that theme's contrast, and `retro` puts base-content on
          base-300 at 5.69:1 — under the 7:1 gate (#411). */}
      <span
        aria-hidden="true"
        data-theme={theme}
        className="flex h-24 flex-col justify-end gap-2 p-3"
        style={{
          background:
            'linear-gradient(180deg, var(--color-base-100), var(--color-base-200))',
        }}
      >
        <span className="flex gap-1.5">
          <span className="bg-primary h-5 w-5 rounded-md" />
          <span className="bg-secondary h-5 w-5 rounded-md" />
          <span className="bg-accent h-5 w-5 rounded-md" />
        </span>
      </span>
      <span className="bg-base-300 text-base-content flex min-h-11 items-center justify-between gap-2 px-3 py-2 font-mono text-[10.5px] tracking-[.12em] uppercase">
        {theme}
        <span className="flex items-center gap-1.5">
          <ContrastBadge theme={theme} />
          {active && <span aria-hidden="true">✓</span>}
        </span>
      </span>
    </button>
  );
}

export default function ThemesPage() {
  const [current, setCurrent] = useState(DEFAULT_THEME);

  useEffect(() => setCurrent(readStoredTheme()), []);

  const choose = (theme: string) => {
    applyTheme(theme);
    setCurrent(theme);
  };

  return (
    <main className="bg-base-100 min-h-full">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <header className="mb-8">
          <p className="text-base-content mb-2 font-mono text-xs tracking-wider uppercase">
            Live switching · no reload
          </p>
          <h1 className="text-base-content font-display text-3xl tracking-[-0.025em] sm:text-[38px]">
            {CURATED_THEMES.length} themes we stand behind
          </h1>
          {/* The comp claims per-theme "AA ✓ / AAA ✓" badges. Deliberately not
              reproduced: the contrast gate sweeps scripthammer-light and
              scripthammer-dark only, so the grade of the other 32 is genuinely
              unmeasured here. A badge asserting it would be the #287 failure —
              a claim nobody checked. This says what is actually true. */}
          <p className="text-base-content mt-3 max-w-[60ch] leading-relaxed">
            These {CURATED_THEMES.length} are the ones we&rsquo;d hand a client.
            The two ScriptHammer themes are gated at WCAG AAA on every push; the
            rest are DaisyUI stock and still work.
          </p>
        </header>

        <ul className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CURATED_THEMES.map((theme) => (
            <li key={theme}>
              <ThemePlate
                theme={theme}
                active={current === theme}
                onApply={choose}
              />
            </li>
          ))}
        </ul>

        {/* The rest, compact, in a well — the comp's "still supported" shelf. */}
        <section aria-labelledby="others-heading" className="mb-12">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="others-heading"
              className="text-base-content font-display text-2xl tracking-[-0.02em]"
            >
              The other {OTHERS.length}
            </h2>
            <p className="text-base-content font-mono text-[11px] tracking-[.12em] uppercase">
              DaisyUI · still supported
            </p>
          </div>
          <ul className="sh-well bg-base-100 flex flex-wrap gap-2 rounded-[24px] p-4">
            {OTHERS.map((theme) => (
              <li key={theme}>
                <button
                  type="button"
                  onClick={() => choose(theme)}
                  aria-pressed={current === theme}
                  className={`text-base-content hover:bg-base-200 focus-visible:ring-primary inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-mono text-[10.5px] tracking-[.12em] uppercase focus-visible:ring-2 ${
                    current === theme ? 'sh-rail-active' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    data-theme={theme}
                    className="flex gap-1"
                  >
                    <span className="bg-primary h-3 w-3 rounded-full" />
                    <span className="bg-secondary h-3 w-3 rounded-full" />
                    <span className="bg-accent h-3 w-3 rounded-full" />
                  </span>
                  {theme}
                  {/* The badge belongs here as much as on a plate, and arguably more:
                      of the four themes that are not AAA, three are in THIS list rather
                      than the curated ten — including `valentine`, the only one that
                      fails AA outright. Badging only the plates would have skipped
                      exactly the theme a visitor most needs warning about (#422). */}
                  <ContrastBadge theme={theme} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* The full switcher stays — it is what every E2E spec drives, and it
            lists all {THEME_COUNT} in one place. */}
        <div className="mx-auto max-w-6xl">
          <ThemeSwitcher />
        </div>
      </div>
    </main>
  );
}
