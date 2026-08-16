import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import {
  seedIsolatedAdmin,
  deleteIsolatedAdmin,
  openAuthedPage,
  type IsolatedAdmin,
} from './utils/test-user-factory';
import { dirname, join } from 'node:path';
import { waitForLoadStateOrGiveUp } from './utils/settle';
import {
  measureNullRatioNodes,
  UNRESOLVABLE_ALLOWLIST,
  VENDOR_EXCLUDED,
} from './utils/contrast-fallback';

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
  passes: AxeRuleResult[];
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
  // #715/#719. This route runs a continuous WebGL render loop, and on a runner with no GPU
  // Chromium composites the canvas through a SYNCHRONOUS GPU readback — a CDP category
  // trace of the sibling twin route measured `GLES2::ReadPixels` at 10.7 s inside a 13 s
  // window. The sweep's readiness wait never settles, so this fails by 30 s TIMEOUT and
  // reports no contrast violations at all. It failed identically on all three retries
  // across eight-plus consecutive `main` runs — deterministic, not flaky.
  //
  // NOTE WHAT THIS COSTS: the page's contrast is now genuinely unmeasured. That is a real
  // gap, tracked in #715, and the fix is a component-level contrast test that does not need
  // the live canvas — not a re-enable of this sweep, which cannot settle here at any timeout.
  // Coverage is NOT lost: tests/e2e/cod-skeleton-hud-contrast.spec.ts measures the HUD
  // chrome against a bracketed black/white scene without ever constructing a renderer —
  // the same move /chatt makes toward twin-glass-contrast.spec.ts. It found the chips at
  // 5.00:1 (light) and 4.51:1 (dark) and drove the fix to bg-base-300/90.
  '/game/cod-skeleton':
    'continuous WebGL render loop; the readiness wait cannot settle under software ' +
    'rendering (synchronous GPU readback, #719) — HUD chrome measured instead by ' +
    'cod-skeleton-hud-contrast.spec.ts',
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

/**
 * ROUTE TEMPLATES ARE NOT `page.tsx`, SO ENUMERATION CANNOT SEE THEM (#425).
 *
 * `enumerateRoutes` emits a route only for `page.tsx`. `not-found.tsx` and
 * `global-error.tsx` are neither, so a template that renders on EVERY bad URL
 * in the product sat outside this gate entirely — and it did have a violation:
 * `text-base-content/80` on the 404 page measured 6.62:1 against the 7:1 floor.
 *
 * Nobody found that on purpose. PR #420 added a `/docs/[slug]` route with no
 * `INSTANCES` entry, so the sweep visited the literal path, 404'd, and measured
 * the not-found page by accident — reporting the failure against `/docs/[slug]`
 * while the real subject was `not-found.tsx`.
 *
 * A template has no URL of its own, so it cannot be enumerated; it has to be
 * REACHED. The 404 renders on any unmatched path, so the sweep asks for one
 * deliberately. `TEMPLATE_MUST_CONTAIN` below then proves the probe actually
 * landed on the 404 page — without it, a path that started resolving to
 * something else would leave this measuring the wrong page and passing.
 */
const TEMPLATE_PROBES: Record<string, { source: string; contains: string }> = {
  '/__contrast-probe-unmatched-route__/': {
    source: 'src/app/not-found.tsx',
    contains: 'Page Not Found',
  },
};

/**
 * Templates that no navigation can reach, recorded rather than left silent —
 * the same contract as EXCLUDED above.
 */
const UNREACHABLE_TEMPLATES: Record<string, string> = {
  'src/app/global-error.tsx':
    'renders only when the ROOT layout itself throws. No URL reaches it, and a ' +
    'static export offers no way to induce that from a navigation, so this gate ' +
    'cannot measure it. Clean by inspection today; if it grows real UI it needs ' +
    'a component-level contrast test, not a route sweep.',
};

const ALL = enumerateRoutes(APP_DIR).sort();
const SKIPPED = ALL.filter((r) => r in EXCLUDED);
const PAGES = [
  ...ALL.filter((r) => !(r in EXCLUDED)).map((r) => INSTANCES[r] ?? r),
  ...Object.keys(TEMPLATE_PROBES),
];

// Loudly, so a shrinking sweep can never read as a passing one.
console.log(
  `[color-contrast] sweeping ${PAGES.length} paths ` +
    `(${ALL.length - SKIPPED.length} of ${ALL.length} routes + ` +
    `${Object.keys(TEMPLATE_PROBES).length} route template(s)) x ${THEMES.length} themes` +
    (SKIPPED.length
      ? `\n[color-contrast] excluded ${SKIPPED.length}:\n` +
        SKIPPED.map((r) => `  - ${r}: ${EXCLUDED[r]}`).join('\n')
      : '') +
    `\n[color-contrast] route templates reached by probe:\n` +
    Object.entries(TEMPLATE_PROBES)
      .map(([p, t]) => `  - ${t.source} via ${p}`)
      .join('\n') +
    `\n[color-contrast] route templates NOT measurable here:\n` +
    Object.entries(UNREACHABLE_TEMPLATES)
      .map(([f, why]) => `  - ${f}: ${why}`)
      .join('\n')
);

test.describe('WCAG AAA color-contrast-enhanced (violations only)', () => {
  // Match pa11yci.json viewport.
  test.use({ viewport: { width: 1280, height: 1024 } });

  for (const theme of THEMES) {
    for (const path of PAGES) {
      test(`${theme} — ${path}`, async ({ page: defaultPage, browser }) => {
        // The six `/admin` routes need an ADMIN session (#454). Until now this
        // sweep listed them and measured THE HOME PAGE: `AdminGate.tsx:81`
        // redirects an authenticated non-admin to `/`, and nothing here
        // asserted the probe landed where it asked. A populated, AAA-clean home
        // page passed six times under other routes' names — not an absent
        // measurement, a WRONG one that read as coverage.
        const needsAdmin = path.startsWith('/admin');
        let adminFixture: IsolatedAdmin | null = null;
        let openedAdmin: Awaited<ReturnType<typeof openAuthedPage>> | null =
          null;
        let page = defaultPage;
        if (needsAdmin) {
          adminFixture = await seedIsolatedAdmin();
          test.skip(!adminFixture, 'Admin client unavailable to seed an admin');
          if (!adminFixture) return;
          openedAdmin = await openAuthedPage(browser, adminFixture.session);
          page = openedAdmin.page;
          await page.setViewportSize({ width: 1280, height: 1024 });
        }

        // ThemeScript.tsx reads localStorage.getItem('theme') before falling
        // back to prefers-color-scheme; seeding it in an init script runs
        // before that inline script.
        await page.addInitScript(
          (t) => window.localStorage.setItem('theme', t),
          theme
        );

        // NOT `networkidle`: /sign-in, /sign-up, /forgot-password and
        // /messages/setup mount Cloudflare Turnstile, so the network never goes
        // idle and the page never resolves. Measured — all four timed out at
        // 25s. Those are the routes handling credentials, so losing them is the
        // opposite of what this gate is for. domcontentloaded plus a settle
        // covers every route.
        //
        // The mechanism, measured precisely in #506: Turnstile opens a `blob:`
        // worker request that NEVER finishes — not periodic polling. This note
        // was accurate and still did not stop the same trap reaching CI in
        // `auth/session-persistence.spec.ts`, so it is now enforced by
        // tests/unit/no-networkidle-on-captcha-routes.test.ts.
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Give client-side redirects and hydration a chance to finish, so the
        // execution context is stable before axe is injected.
        await waitForLoadStateOrGiveUp(page, 'load');
        // 3000ms mirrored pa11yci's `wait` when this swept 4 pages; across the
        // full route list that is minutes of pure idling. 1200ms is the settle
        // that replaces the load-state guarantee given up above.
        await page.waitForTimeout(1200);

        // PROVE THE PROBE LANDED ON THE TEMPLATE IT CLAIMS TO MEASURE (#425).
        // This path only reaches not-found.tsx for as long as nothing else
        // resolves it. If that ever changes, the sweep would quietly measure a
        // different page and report it as template coverage — which is the
        // failure mode this whole ticket is about.
        // Same guarantee as the template probe below, for the admin routes:
        // a redirect here means everything measured belongs to another page.
        if (needsAdmin) {
          await expect(
            page,
            `${path}: redirected away before measuring. The admin fixture did ` +
              `not take, and axe would be reporting the home page under this ` +
              `route's name — which is #454 itself.`
          ).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}\\/?$`));
        }

        const probe = TEMPLATE_PROBES[path];
        if (probe) {
          await expect(
            page.getByText(probe.contains),
            `${path} must render ${probe.source} (looking for "${probe.contains}"); ` +
              `if it does not, this test is measuring the wrong page`
          ).toBeVisible();
        }

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
            // 'passes' IS LOAD-BEARING, NOT COMPLETENESS (#459). axe returns a
            // PASS for elements whose ratio it could not compute, with
            // `contrastRatio: null` — 120 of 608 across eight routes, one in
            // five. Those are unmeasured, not verified.
            //
            // And `resultTypes` does not merely filter the report: any group
            // NOT listed is TRUNCATED TO ONE NODE. Measured on /pricing —
            // without 'passes' axe returns 1 pass node, with it 96, of which 8
            // have a null ratio. So an audit of `passes` that forgets to ask
            // for them inspects a single element and calls the page clean,
            // which is #459 reproduced inside the fix for #459.
            resultTypes: ['violations', 'incomplete', 'passes'],
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

        // UNMEASURED ELEMENTS AXE REPORTED AS PASSING (#459). A null ratio means
        // axe could not compute one — most often a background it cannot resolve
        // (an image, a gradient, a transparent stack). It is not a pass; it is a
        // question that was never answered, and it was being counted as covered.
        const unmeasured: string[] = (results.passes ?? []).flatMap((rule) =>
          rule.nodes
            .filter((n) => (n.any?.[0]?.data?.contrastRatio ?? null) === null)
            .map((n) => n.target?.[0])
            // A node axe cannot give a selector for cannot be re-resolved in the
            // page either, so it would only become a phantom "unresolvable".
            .filter((t): t is string => typeof t === 'string')
        );
        const passCount = (results.passes ?? []).reduce(
          (n, v) => n + v.nodes.length,
          0
        );
        // MEASURE THEM OURSELVES (#459). Reporting the count was the previous
        // behaviour and it closed nothing — a printed number can grow for
        // months without anyone reading the log. Every one of these is text on
        // a gradient, which axe declines to compute but which is perfectly
        // computable from the gradient's stops. See utils/contrast-fallback.ts
        // for why worst-of-stops is the correct bound and why canvas readback
        // is the only thing that resolves this codebase's oklch() colours.
        const fallback = unmeasured.length
          ? await page.evaluate(measureNullRatioNodes, unmeasured)
          : [];

        const fallbackFailures = fallback
          .filter((r) => r.kind === 'measured' && r.ratio! < r.required!)
          // Vendor chrome we do not style. Named and reasoned in
          // VENDOR_EXCLUDED, never a bare threshold.
          .filter(
            (r) =>
              !VENDOR_EXCLUDED.some(
                (v) =>
                  r.selector.includes(v.selectorFragment) ||
                  r.signature.includes(v.selectorFragment)
              )
          )
          .map((r) => ({
            target: r.selector,
            html: `${r.signature}  "${r.text}"`,
            fg: r.fg,
            bg: r.bg,
            ratio: r.ratio,
            expected: r.required,
            note: `axe reported this as a PASS with contrastRatio: null (${r.mode})`,
          }));

        // Anything still unmeasurable must be a KNOWN category. Asserted as a
        // set rather than a count: a count stays green while one unresolvable
        // node appears and another is fixed.
        const unresolvedUnknown = fallback
          .filter((r) => r.kind === 'unresolvable')
          .filter(
            (r) =>
              !UNRESOLVABLE_ALLOWLIST.some(
                (a) => a.signature.test(r.signature) && a.reason === r.reason
              )
          )
          .map(
            (r) =>
              `${r.signature} [${r.reason}] "${r.text}"` +
              (r.baseColorRatio
                ? ` (base background-color alone would be ${r.baseColorRatio}:1)`
                : '')
          );

        const measuredByFallback = fallback.filter(
          (r) => r.kind === 'measured'
        ).length;
        const notVisible = fallback.filter(
          (r) => r.kind === 'not-visible'
        ).length;
        if (unmeasured.length) {
          console.log(
            `${path} [${theme}]: ${passCount} axe passes, ${unmeasured.length} with a ` +
              `null ratio -> ${measuredByFallback} measured by fallback, ` +
              `${notVisible} not visible, ` +
              `${fallback.length - measuredByFallback - notVisible} unresolvable`
          );
        }

        // Tear the throwaway admin down BEFORE the assertion, so a violation
        // does not leave a live admin account behind. `auth.setup.ts` sweeps
        // orphans, but a failing test is exactly when you least want to rely
        // on a backstop.
        if (openedAdmin) await openedAdmin.close();
        await deleteIsolatedAdmin(adminFixture);

        // A NEW unmeasurable CATEGORY is a failure, because the alternative is
        // the gate quietly shrinking again. Fix the element, or add an
        // allowlist entry that says why it cannot be measured.
        expect(
          unresolvedUnknown,
          `${path} [${theme}]: ${unresolvedUnknown.length} element(s) could not be ` +
            `measured and are not in UNRESOLVABLE_ALLOWLIST (tests/e2e/utils/` +
            `contrast-fallback.ts). axe reported them as PASSING with a null ` +
            `ratio, so leaving them here means they are unverified:\n  ` +
            unresolvedUnknown.join('\n  ')
        ).toEqual([]);

        // ONE assertion for both sources. axe's own violations and the ones it
        // declined to compute are the same defect to a user, so they fail the
        // same way and carry the same fg/bg/ratio dump.
        const allFailures = [...details, ...fallbackFailures];
        expect(
          allFailures,
          `color-contrast-enhanced (AAA) violations on ${path} [${theme}] ` +
            `(${incompleteCount} incomplete/needs-review — expected, not a failure; ` +
            `${fallbackFailures.length} of these were measured by the #459 fallback ` +
            `after axe passed them with a null ratio):\n` +
            JSON.stringify(allFailures, null, 2)
        ).toHaveLength(0);
      });
    }
  }
});
