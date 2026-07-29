import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Pa11y's axe runner reports axe `incomplete` results as errors, which
// produces 14–61 false positives per page on DaisyUI — .btn gradients
// prevent axe from resolving a flat background color, so every button
// lands in the needs-review bucket. That's why config/pa11yci.json keeps
// color-contrast (and color-contrast-enhanced) in its ignore list.
//
// This spec is the real contrast gate. It runs the AAA enhanced-contrast
// rule (7:1 normal text / 4.5:1 large text) against the same pages but
// asserts only on `violations` — cases where axe measured the ratio and
// confirmed it's under the WCAG AAA threshold.
//
// Bumped from `color-contrast` (AA, 4.5:1 / 3:1) to `color-contrast-enhanced`
// (AAA, 7:1 / 4.5:1) per #21 Phase 0 closure. The features/foundation/
// 001-wcag-aa-compliance/spec.md was originally written for AAA; the code
// had drifted to AA. Aligning code to the spec rather than the inverse.

// axe-core is a transitive dep under pnpm's strict node_modules; resolve it
// through jest-axe (direct dep) so the path survives lockfile bumps.
// Playwright's TS transform runs as CJS, so `require` is ambient here.
const jestAxeEntry: string = require.resolve('jest-axe');
const axePath: string = require.resolve('axe-core/axe.min.js', {
  paths: [dirname(jestAxeEntry)],
});
const axeSource = readFileSync(axePath, 'utf8');

interface ContrastNodeData {
  fgColor?: string;
  bgColor?: string;
  contrastRatio?: number;
  expectedContrastRatio?: string;
  fontSize?: string;
  fontWeight?: string;
}

interface AxeNode {
  target?: string[];
  html?: string;
  any?: Array<{ data?: ContrastNodeData; message?: string }>;
}

interface AxeRuleResult {
  id: string;
  nodes: AxeNode[];
}

interface AxeResults {
  violations: AxeRuleResult[];
  incomplete: AxeRuleResult[];
}

// Both custom themes covered — Pa11y's headless Chromium defaults to
// prefers-color-scheme: light, so before this spec the dark palette had
// no automated contrast coverage at all.
const THEMES = ['scripthammer-light', 'scripthammer-dark'] as const;

/**
 * ROUTES ARE ENUMERATED, NOT LISTED (#411).
 *
 * This list used to be four hand-written paths mirroring `config/pa11yci.json`.
 * That covered 4 of this app's 43 routes — 9% — and a 6.44:1 eyebrow reached
 * main on /blog with 17 green checks because /blog simply was not looked at.
 * A green run meant "these four pages meet AAA", which is not what anyone read
 * it as.
 *
 * Deriving from `src/app/**\/page.tsx` means a new route is covered the day it
 * is created, and opting one out is an explicit, visible entry below rather
 * than an omission nobody notices.
 *
 * The pa11y mirror is deliberately NOT maintained any more: pa11y ignores both
 * contrast rules entirely (see the header above), so mirroring it for a
 * contrast gate was never meaningful.
 */
const APP_DIR = join(process.cwd(), 'src/app');

/** Routes that cannot be measured, each with the reason. Never silent. */
const EXCLUDED: Record<string, string> = {
  '/auth/callback':
    'transient OAuth handler — redirects on load, there is no UI to measure',
  '/twins/[slug]':
    'twin payloads are privacy-gated and gitignored; absent in a fresh checkout',
  // Headless Firefox has no WebGL, so Cesium cannot construct and renders its
  // OWN error panel — `.cesium-widget-errorPanel-header`, measured at 6.49:1.
  // That is vendor markup we do not ship or control, appearing only in a
  // browser that cannot run the widget at all; chromium passed, which is why
  // the PR was green and `main` went red on the post-merge firefox shard.
  //
  // The route's real UI is not left unchecked: tests/e2e/twin-glass-contrast.spec.ts
  // measures the twin chrome against the scene directly, which is the contrast
  // question that actually matters here.
  '/chatt':
    'Cesium error panel is vendor markup; headless Firefox has no WebGL',
};

/** Dynamic segments need a real instance — the template alone proves nothing. */
const INSTANCES: Record<string, string> = {
  '/blog/[slug]': '/blog/playable-city-chattanooga',
  // Was excluded with the reason "no post declares a tag". That was wrong: I
  // read `post.tags` at the top level, where nothing lives. Tags are under
  // `metadata.tags` — 53 distinct across 12 posts — and
  // blog/tags/[tag]/page.tsx:45 builds its params from exactly that field.
  '/blog/tags/[tag]': '/blog/tags/digital-twin',
  // Without this the sweep visits the literal path `/docs/[slug]`, which 404s
  // — so it measured the not-found page and reported the failure against
  // `/docs/[slug]`. That accident is what found #425; the 404 page's own
  // violation is fixed there, and bringing route templates into a gate is
  // tracked by it.
  '/docs/[slug]': '/docs/install-and-first-run',
};

function enumerateRoutes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Route groups `(name)` and private folders `_name` contribute no URL
      // segment. `[slug]` DOES — an earlier version collapsed it too, which
      // merged /blog/tags/[tag] onto /blog/tags and produced duplicate test
      // titles that Playwright rejects outright.
      const seg =
        entry.name.startsWith('(') || entry.name.startsWith('_')
          ? ''
          : `/${entry.name}`;
      out.push(...enumerateRoutes(join(dir, entry.name), prefix + seg));
    } else if (entry.name === 'page.tsx') {
      out.push(prefix === '' ? '/' : prefix);
    }
  }
  return out;
}

const ALL = enumerateRoutes(APP_DIR).sort();
const SKIPPED = ALL.filter((r) => r in EXCLUDED);
const PAGES = ALL.filter((r) => !(r in EXCLUDED)).map((r) => INSTANCES[r] ?? r);

// Loudly, so a shrinking sweep can never read as a passing one.
console.log(
  `[color-contrast] sweeping ${PAGES.length} of ${ALL.length} routes x ${THEMES.length} themes` +
    (SKIPPED.length
      ? `\n[color-contrast] excluded ${SKIPPED.length}:\n` +
        SKIPPED.map((r) => `  - ${r}: ${EXCLUDED[r]}`).join('\n')
      : '')
);

test.describe('WCAG AAA color-contrast-enhanced (violations only)', () => {
  // Match pa11yci.json viewport.
  test.use({ viewport: { width: 1280, height: 1024 } });

  for (const theme of THEMES) {
    for (const path of PAGES) {
      test(`${theme} — ${path}`, async ({ page }) => {
        // ThemeScript.tsx reads localStorage.getItem('theme') before falling
        // back to prefers-color-scheme; seeding it in an init script runs
        // before that inline script.
        await page.addInitScript(
          (t) => window.localStorage.setItem('theme', t),
          theme
        );

        // NOT `networkidle`: /sign-in, /sign-up, /forgot-password and
        // /messages/setup mount Cloudflare Turnstile, which polls forever, so
        // the network never goes idle and the page never resolves. Measured —
        // all four timed out at 25s. Those are the routes handling
        // credentials, so losing them is the opposite of what this gate is
        // for. domcontentloaded plus a settle covers every route.
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Give client-side redirects and hydration a chance to finish, so the
        // execution context is stable before axe is injected.
        await page.waitForLoadState('load').catch(() => {});
        // 3000ms mirrored pa11yci's `wait` when this swept 4 pages; across the
        // full route list that is minutes of pure idling. 1200ms is the settle
        // that replaces the load-state guarantee given up above.
        await page.waitForTimeout(1200);

        await page.evaluate(axeSource);
        const results = await page.evaluate<AxeResults>(async () => {
          // Playwright RETRIES an evaluate whose execution context is destroyed
          // mid-call — which is what a client-side redirect or a late hydration
          // does. A bare axe.run() then starts a second time while the first is
          // still in flight and throws "Axe is already running".
          //
          // Measured: 13 of the 40 routes hit this — /sign-in, /sign-up,
          // /account, /chatt, /wireframes and friends, i.e. exactly the ones
          // that navigate or mount late. Caching the promise on `window` makes
          // the retry return the original run instead of starting a rival one.
          const w = window as unknown as {
            __shAxeRun?: Promise<AxeResults>;
            axe: { run: (d: Document, o: unknown) => Promise<AxeResults> };
          };
          w.__shAxeRun ??= w.axe.run(document, {
            runOnly: { type: 'rule', values: ['color-contrast-enhanced'] },
            resultTypes: ['violations', 'incomplete'],
          });
          return w.__shAxeRun;
        });

        // On failure, dump the fg/bg/ratio triple so the fix is obvious
        // without having to re-run the probe script.
        const details = results.violations.flatMap((v) =>
          v.nodes.map((n) => {
            const d = n.any?.[0]?.data ?? {};
            return {
              target: n.target?.[0],
              html: n.html?.slice(0, 100),
              fg: d.fgColor,
              bg: d.bgColor,
              ratio: d.contrastRatio,
              expected: d.expectedContrastRatio,
              fontSize: d.fontSize,
              fontWeight: d.fontWeight,
            };
          })
        );

        const incompleteCount = results.incomplete.reduce(
          (n, v) => n + v.nodes.length,
          0
        );

        expect(
          details,
          `color-contrast-enhanced (AAA) violations on ${path} [${theme}] ` +
            `(${incompleteCount} incomplete/needs-review — expected, not a failure):\n` +
            JSON.stringify(details, null, 2)
        ).toHaveLength(0);
      });
    }
  }
});
