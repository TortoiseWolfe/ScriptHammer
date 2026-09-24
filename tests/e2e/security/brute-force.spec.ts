// Brute force: wrong passwords typed at someone's address must not keep them out (#1245)
//
// This file used to assert the opposite: that five wrong passwords locked an email out of
// sign-in, across sessions, and that clearing localStorage did not lift it. The lockout was
// keyed on the address and ran in the browser, so it never stood in front of anyone who called
// Supabase Auth directly — and anyone could trigger it for anyone, with five anonymous RPCs or
// five tries at the form. Stage A2 of #1245 removed it. Sign-in's brute-force limits are
// Supabase Auth's own: a captcha on every password grant, and per-IP ceilings on hosted projects.
//
// So the property worth pinning is the victim's. Each test below fails against the pre-A2 code:
// the form answered the sixth wrong password with a lockout instead of asking Auth, and the
// limiter RPCs let an anonymous caller write that lockout directly.
//
// Runs where the real form can be submitted without a Turnstile token — the local stack in
// signup-mailer.yml — and skips only where captcha protects the backend. Anything else that
// stops it from running is an error, not a skip: that lane has no assertion-count gate, so a
// skipped security test would report green.

import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import {
  assertLocalBackend,
  createTestUser,
  deleteTestUserByEmail,
  dismissCookieBanner,
  isAdminClientAvailable,
} from '../utils/test-user-factory';
import { skipIfBackendCaptchaProtected } from '../utils/captcha-guard';

const WRONG_PASSWORD = 'NotTheirPassword123!';

function victimEmail(): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const base = process.env.TEST_USER_PRIMARY_EMAIL || '';
  if (base.includes('@gmail.com')) {
    const user = base.split('+')[0].split('@')[0];
    return `${user}+bf-${stamp}@gmail.com`;
  }
  const domain = base.includes('@') ? base.split('@')[1] : 'example.com';
  return `bf-${stamp}@${domain}`;
}

/**
 * Submit the form and return Auth's answer. Waiting on the response, not the alert: the alert
 * from the previous attempt carries the same text, so an alert assertion alone could read the
 * last answer instead of this one. And the pre-A2 form refused the sixth attempt without asking
 * Auth at all — this wait is where that shows.
 */
async function submit(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith('/auth/v1/token') &&
        r.request().method() === 'POST',
      { timeout: 10_000 }
    ),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
  return response;
}

/** The form's own alert — never Next's route announcer, which is also role="alert". */
const formError = (page: Page) =>
  page
    .getByRole('alert')
    .filter({ hasText: /credentials|too many|locked|attempt/i });

async function sixWrongPasswords(page: Page, email: string) {
  for (let i = 1; i <= 6; i++) {
    const answer = await submit(page, email, WRONG_PASSWORD);
    expect(answer.status(), `attempt ${i} reached Auth`).toBe(400);
    await expect(formError(page), `attempt ${i}`).toHaveText(
      /^\s*invalid login credentials\s*$/i
    );
  }
}

/** Signed in, shown by where the app sends a person and what it then shows them. */
async function expectSignedIn(page: Page, email: string, password: string) {
  const answer = await submit(page, email, password);
  expect(answer.status(), 'the real password was accepted').toBe(200);
  await expect(page).toHaveURL(/\/profile\/?$/);
  await expect(page.getByLabel('User account menu')).toBeVisible();
}

/** An anonymous PostgREST call with the public key — exactly what anyone on the internet has. */
async function anonRpc(fn: string, args: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY unset');
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test.describe('Brute force: nobody can lock someone else out (#1245)', () => {
  let email: string;
  let password: string;

  test.beforeEach(async () => {
    await skipIfBackendCaptchaProtected(
      'Wrong passwords for an address do not lock its owner out (#1245)'
    );
    if (!isAdminClientAvailable()) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is unset, so no victim can be seeded. This lane has no ' +
          'assertion-count gate — a skip here would report a security test as passing.'
      );
    }
    assertLocalBackend('brute-force.spec.ts');
    email = victimEmail();
    password = `${randomUUID()}Aa1!`;
    const user = await createTestUser(email, password, { createProfile: true });
    if (!user) throw new Error(`could not seed the victim ${email}`);
  });

  test.afterEach(async () => {
    if (email) await deleteTestUserByEmail(email);
  });

  test('six anonymous RPCs naming the address do not lock its owner out', async ({
    page,
  }) => {
    // The weapon itself: no form, no captcha, just the public key and someone's address.
    for (let i = 0; i < 6; i++) {
      const r = await anonRpc('record_failed_attempt', {
        p_identifier: email,
        p_attempt_type: 'sign_in',
      });
      expect(r.status, `record ${i + 1}`).toBeLessThan(300);
    }
    const check = await anonRpc('check_rate_limit', {
      p_identifier: email,
      p_attempt_type: 'sign_in',
    });
    expect(check.status).toBe(200);
    // Before A2: {allowed: false, locked_until: <15 minutes out>}.
    expect(check.body).toEqual({
      allowed: true,
      remaining: 5,
      locked_until: null,
    });

    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await expectSignedIn(page, email, password);
  });

  test('six wrong passwords from another browser do not stop the owner signing in', async ({
    browser,
  }) => {
    const stranger = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const owner = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const attacker = await stranger.newPage();
      await attacker.goto('/sign-in');
      await dismissCookieBanner(attacker);
      await sixWrongPasswords(attacker, email);

      const page = await owner.newPage();
      await page.goto('/sign-in');
      await dismissCookieBanner(page);
      await expectSignedIn(page, email, password);
    } finally {
      await stranger.close();
      await owner.close();
    }
  });

  test('the owner can still sign in straight after six mistakes of their own', async ({
    page,
  }) => {
    // The same browser, so nothing the old form kept per tab could explain a pass.
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await sixWrongPasswords(page, email);
    await expectSignedIn(page, email, password);
  });
});
