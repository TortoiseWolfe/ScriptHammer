/**
 * `networkidle` must never be awaited on a route that mounts Turnstile (#506).
 *
 * ## The defect
 *
 * Cloudflare Turnstile opens a `blob:` worker request that **never settles**.
 * Measured on a root build carrying the public test key, on `/sign-in`:
 *
 *     +169ms REQ  challenges.cloudflare.com/turnstile/v0/api.js
 *     +305ms FIN
 *     +305ms REQ  challenges.cloudflare.com/turnstile/v0/g/<id>/api.js
 *     +342ms FIN
 *     +348ms REQ  challenges.cloudflare.com/cdn-cgi/challenge-platform/...
 *     +434ms FIN
 *     +446ms REQ  blob:https://challenges.cloudflare.com/<uuid>     <- no FIN, ever
 *
 *     networkidle: TIMED OUT after 30s (never idle)
 *
 * Against the same build with no site key the identical page reaches
 * networkidle in **537ms**. So the hazard appears the moment a widget renders —
 * it is not a property of the route, it is a property of the widget being
 * configured.
 *
 * ## Why a test and not a comment
 *
 * A comment already existed, was accurate, and did not prevent this.
 * `tests/e2e/color-contrast.spec.ts` has said since #425:
 *
 *   > NOT `networkidle`: /sign-in, /sign-up, /forgot-password and
 *   > /messages/setup mount Cloudflare Turnstile, which polls forever, so the
 *   > network never goes idle and the page never resolves. Measured — all four
 *   > timed out at 25s.
 *
 * When #506 put `NEXT_PUBLIC_CAPTCHA_SITE_KEY` into `e2e.yml` — rendering the
 * widget in CI for the first time — `auth/session-persistence.spec.ts` timed
 * out in `beforeEach` on all three attempts and took a shard red. The prose was
 * one file away from the change and was not consulted. `Test (20.x)` is a
 * required check; this is.
 *
 * ## Scope
 *
 * Only navigations to Turnstile routes are flagged. The suite has ~100 other
 * `networkidle` waits — `/payment-demo`, `/admin/*`, `/account`, `/messages`,
 * `/themes` — which mount no widget and are none of this test's business.
 * Flagging those would be unrelated churn dressed up as rigour.
 *
 * @module tests/unit/no-networkidle-on-captcha-routes.test
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const E2E_DIR = 'tests/e2e';

/**
 * Routes that mount `CaptchaWidget`. Re-derive rather than trust: grep for
 * `CaptchaWidget` under `src/components/auth/` — today that is `SignInForm`
 * (/sign-in), `SignUpForm` (/sign-up), `ForgotPasswordForm`
 * (/forgot-password), and `EmailVerificationNotice` via `MessagingGate`
 * (/messages/setup). Add the route here when a fifth appears.
 */
const CAPTCHA_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/messages/setup',
];

/**
 * How many lines of CODE may sit between a navigation and a `networkidle`
 * before they are treated as unrelated. Comments do not count.
 *
 * The first version of this counted RAW lines with a window of 6, and it could
 * not fail: the fix in `session-persistence.spec.ts` carries an eleven-line
 * comment explaining the hazard, so reintroducing the defect underneath it put
 * the offence twelve raw lines from the navigation — outside the window. The
 * mutation test passed and the guard was worthless. A rule whose reach depends
 * on how much prose someone wrote is not a rule.
 */
const MAX_CODE_LINES_BETWEEN = 25;

/**
 * Built at runtime, not written as literals.
 *
 * This file names the routes and the offending API in its own documentation
 * above. A scan that matched its own prose would fail on the explanation, and
 * the natural repair for that is to delete the explanation. Same reasoning as
 * `no-build-in-dev-container.test.ts` and `tailwind-literal-classes.test.ts`.
 */
const IDLE = ['network', 'idle'].join('');
const NAV_RE = new RegExp(['goto', '\\(|', 'reload', '\\('].join(''));

function specFiles(dir: string): string[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const p = join(full, entry.name);
    if (entry.isDirectory()) {
      out.push(...specFiles(relative(ROOT, p)));
    } else if (/\.ts$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

interface Hit {
  file: string;
  line: number;
  route: string;
  text: string;
}

function scan(): { hits: Hit[]; filesRead: number; otherIdleUses: number } {
  const hits: Hit[] = [];
  let filesRead = 0;
  let otherIdleUses = 0;

  for (const file of specFiles(E2E_DIR)) {
    const rel = relative(ROOT, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    filesRead++;

    // Walk forward carrying "the page is currently on <route>". A navigation
    // sets or clears it; a `networkidle` while it is set is the defect. This
    // is what the browser actually does, so it does not care how the source is
    // formatted or commented.
    let pendingRoute: string | null = null;
    let codeLinesSince = 0;

    lines.forEach((line, i) => {
      // Prose about this rule is documentation of the defect, not an instance.
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*');
      if (isComment || trimmed === '') return;

      if (line.includes(IDLE)) otherIdleUses++;

      if (NAV_RE.test(line)) {
        // A navigation always re-points the page — to a Turnstile route (arm)
        // or away from one (disarm).
        pendingRoute = CAPTCHA_ROUTES.find((r) => line.includes(r)) ?? null;
        codeLinesSince = 0;
        // fall through: `goto(url, { waitUntil: 'networkidle' })` is one line
      } else if (pendingRoute) {
        codeLinesSince++;
        if (codeLinesSince > MAX_CODE_LINES_BETWEEN) {
          pendingRoute = null;
          return;
        }
      }

      if (pendingRoute && line.includes(IDLE)) {
        hits.push({
          file: rel,
          line: i + 1,
          route: pendingRoute,
          text: trimmed.slice(0, 120),
        });
        pendingRoute = null; // one report per navigation
      }
    });
  }
  return { hits, filesRead, otherIdleUses };
}

describe('no networkidle waits on Turnstile routes (#506)', () => {
  const { hits, filesRead, otherIdleUses } = scan();

  it('actually reads the E2E specs it claims to scan', () => {
    // A scan that reads nothing finds nothing and reads as a pass — the
    // #411/#454 shape. Assert CONTENT, not just a file count: the suite is
    // known to use networkidle heavily on non-Turnstile routes, so seeing a
    // healthy number of those proves the reader works and that the filter,
    // not an empty read, is what produces a small hit list.
    expect(filesRead).toBeGreaterThan(50);
    expect(
      otherIdleUses,
      "expected to see the suite's many legitimate networkidle waits on " +
        'non-Turnstile routes. Seeing none means this scan is not reading ' +
        'file contents, so zero offences below would prove nothing.'
    ).toBeGreaterThan(20);
  });

  it('no spec awaits networkidle after navigating to a Turnstile route', () => {
    expect(
      hits.map((h) => `${h.file}:${h.line}  (${h.route})  ${h.text}`),
      'Turnstile opens a blob: worker request that never settles, so ' +
        'networkidle never fires on these routes and the test burns its whole ' +
        'timeout (#506).\n' +
        'Wait for what you actually need instead — a web-first assertion on ' +
        'the form retries, a load-state does not:\n\n' +
        "    await expect(page.getByLabel('Email')).toBeVisible();\n\n" +
        'Precedent: tests/e2e/color-contrast.spec.ts and ' +
        'tests/e2e/auth/session-persistence.spec.ts.\n'
    ).toEqual([]);
  });
});
