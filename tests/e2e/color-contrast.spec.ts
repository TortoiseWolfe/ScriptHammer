import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Pa11y's axe runner reports axe `incomplete` results as errors, which
// produces 14–61 false positives per page on DaisyUI — .btn gradients
// prevent axe from resolving a flat background color, so every button
// lands in the needs-review bucket. That's why config/pa11yci.json keeps
// color-contrast in its ignore list.
//
// This spec is the real contrast gate. It runs the same rule against the
// same pages but asserts only on `violations` — cases where axe measured
// the ratio and confirmed it's under the WCAG AA threshold.

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

// Mirrors config/pa11yci.json's urls[].
const PAGES = ['/', '/themes/', '/accessibility/', '/status/'] as const;

test.describe('WCAG AA color-contrast (violations only)', () => {
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

        await page.goto(path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // Match pa11yci.json `wait`.

        await page.evaluate(axeSource);
        const results = await page.evaluate<AxeResults>(() =>
          // @ts-expect-error — axe is injected as a global by the line above
          axe.run(document, {
            runOnly: { type: 'rule', values: ['color-contrast'] },
            resultTypes: ['violations', 'incomplete'],
          })
        );

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
          `color-contrast violations on ${path} [${theme}] ` +
            `(${incompleteCount} incomplete/needs-review — expected, not a failure):\n` +
            JSON.stringify(details, null, 2)
        ).toHaveLength(0);
      });
    }
  }
});
