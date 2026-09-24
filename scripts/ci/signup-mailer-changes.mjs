#!/usr/bin/env node
/**
 * Decide whether a change needs the signup-mailer suite to run (#870).
 *
 * WHY THIS EXISTS. `signup-mailer.yml` used to carry a trigger `paths:` filter, so it
 * reported nothing on an unrelated PR — and a required check that never reports is
 * **pending forever**, not skipped. This suite is the only coverage of a REAL form signup
 * against a real mailbox (#288, born from a green suite while no human could actually
 * sign up on production), so it going red without blocking anything is precisely the
 * #572 defect.
 *
 * It is also a 25-minute run against a full local stack, which is why the decision is
 * kept — an unrelated PR costs one trivial job instead.
 *
 * USAGE
 *   node scripts/ci/signup-mailer-changes.mjs <base-sha> <head-sha>
 *   node scripts/ci/signup-mailer-changes.mjs --files a.md b.ts
 *   node scripts/ci/signup-mailer-changes.mjs --selftest
 */

import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Paths whose change can alter what this suite observes.
 *
 * WIDER than the filter it replaces, and each addition is a real way the verdict moves
 * without any of the old paths being touched:
 *
 *   - `src/config/captcha.config.ts` derives `enabled: Boolean(siteKey)`. Turning that on
 *     makes the CLIENT demand a token the local GoTrue never asked for, and every auth
 *     test fails on a challenge nothing wanted (#353). It gates the very form under test.
 *   - `src/lib/auth/` holds the email and password validators — they decide whether the
 *     form submits at all.
 *   - `src/lib/supabase/` holds the client and its session storage; #845 changed exactly
 *     that and it governs what happens after the confirmation link is followed.
 *   - `scripts/supabase/` carries the GoTrue settings, including the mailer URL paths the
 *     confirmation link depends on.
 *   - the lockfile: a dependency bump changes client behaviour with no source edit.
 *   - the `captcha-blocked` project's specs and the helpers they seed through. They run
 *     nowhere else — every other lane skips them for captcha — so a PR editing only them
 *     used to report "suite skipped, reporting green" without running them once (#1245).
 *   - `src/app/sign-in/` and `src/app/forgot-password/`: the pages those specs drive.
 *   - `supabase/migrations/`: brute-force.spec.ts calls the limiter RPCs anonymously and
 *     asserts nobody can be locked out, so a SQL-only change to them (#1245's stage A4)
 *     moves its verdict with no client edit at all. *   - `src/app/reset-password/`: where password-reset.spec.ts follows the emailed link. It
 *     is the only test that clicks a reset email, so the page changing alone must run it
 *     (#1255).
 */
export const SIGNUP_MAILER_PATHS = [
  'src/components/auth/',
  'src/app/sign-up/',
  'src/app/verify-email/',
  'src/app/auth/callback/',
  'src/contexts/AuthContext.tsx',
  'src/config/captcha.config.ts',
  'src/lib/auth/',
  'src/lib/supabase/',
  'scripts/supabase/',
  'scripts/ci/signup-mailer-changes.mjs',
  'tests/e2e/signup-mailer/',
  'tests/e2e/utils/mailpit.ts',
  'tests/e2e/security/brute-force.spec.ts',
  'tests/e2e/auth/rate-limiting.spec.ts',
  'tests/e2e/auth/sign-up.spec.ts',
  'tests/e2e/utils/test-user-factory.ts',
  'tests/e2e/utils/captcha-guard.ts',
  'src/app/sign-in/',
  'src/app/forgot-password/',
  'src/app/reset-password/',
  'supabase/migrations/',
  'playwright.signup-mailer.config.ts',
  'docker-compose.yml',
  'pnpm-lock.yaml',
  '.github/workflows/signup-mailer.yml',
];

/** True when any changed file is one this suite's verdict can depend on. */
export function needsSignupMailer(files) {
  return files.some((f) =>
    SIGNUP_MAILER_PATHS.some((p) =>
      p.endsWith('/') ? f.startsWith(p) : f === p
    )
  );
}

function changedFiles(base, head) {
  return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

function main(argv) {
  if (argv.includes('--selftest')) {
    // A decider that can only ever reach one answer is not a decider.
    const yes = needsSignupMailer([
      'src/components/auth/SignUpForm/SignUpForm.tsx',
    ]);
    const no = needsSignupMailer([
      'README.md',
      'src/components/atomic/Card/Card.tsx',
    ]);
    const captcha = needsSignupMailer(['src/config/captcha.config.ts']);
    if (!yes || no || !captcha) {
      console.error(
        `selftest FAILED: signup=${yes} unrelated=${no} captcha=${captcha}`
      );
      process.exit(1);
    }
    console.log(
      'selftest ok: yes to the signup form, no to unrelated UI, yes to captcha config'
    );
    return;
  }

  const flag = argv.indexOf('--files');
  const files =
    flag !== -1 ? argv.slice(flag + 1) : changedFiles(argv[0], argv[1]);
  const run = needsSignupMailer(files);
  console.log(
    `  ${files.length} changed file(s); signup mailer ${run ? 'REQUIRED' : 'not required'}`
  );
  if (!run) for (const f of files.slice(0, 10)) console.log(`    skip: ${f}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`)
  main(process.argv.slice(2));
