# Authentication Setup Guide (PRP-016)

Complete guide for configuring Supabase authentication with email/password and OAuth providers.

> **Forking ScriptHammer for the first time?** Start at [`docs/FORK-CHECKLIST.md`](FORK-CHECKLIST.md) — it's the master walkthrough covering every external service this template integrates with (auth, payments, email, analytics). This document is the deep-dive for the auth portion.

## Prerequisites

- Supabase project created — substitute its ref for `<YOUR-PROJECT-REF>` in the URLs below
- Environment variables configured in `.env.local`

## Part 1: Database Setup

### 1.1 Run SQL Migrations

**Step 1:** Navigate to Supabase SQL Editor

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/sql

**Step 2:** Drop all existing tables (clean slate)

- Open file: `supabase/migrations/999_drop_all_tables.sql`
- Copy **entire file contents**
- Paste into SQL Editor
- Click **"RUN"**
- Expected output: `Success. No rows returned`

**Step 3:** Create all tables (payment + authentication)

- Open file: `supabase/migrations/complete_setup.sql`
- Copy **entire file contents**
- Paste into SQL Editor
- Click **"RUN"**
- Expected output: `Success. No rows returned`

**Step 4:** Verify tables were created

- Navigate to: https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/editor
- You should see these tables:
  - `payment_intents` ← Payment system
  - `payment_results` ← Payment system
  - `subscriptions` ← Payment system
  - `webhook_events` ← Payment system
  - `payment_provider_config` ← Payment system
  - `user_profiles` ← Authentication
  - `auth_audit_logs` ← Authentication

**IMPORTANT:** If you see errors about the trigger failing, the `complete_setup.sql` file includes the fix with `SECURITY DEFINER` to bypass RLS.

## Part 2: Enable Email/Password Authentication

### 2.1 Enable Email Provider

**Step 1:** Navigate to Auth Providers

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/providers

**Step 2:** Find "Email" in the provider list

- Scroll down to find the **"Email"** provider (should be near the top)

**Step 3:** Enable the provider

- Click on **"Email"** to expand settings
- Toggle **"Enable Email provider"** to **ON**

**Step 4:** Configure email settings (optional)

- **Confirm email:** ON (recommended - users must verify email before sign-in)
- **Secure email change:** ON (recommended - requires confirmation for email changes)
- **Double confirm email changes:** OFF (unless you want extra security)

**Step 5:** Save changes

- Click **"Save"** at the bottom of the page

### 2.2 Configure Email Templates (Optional)

**Step 1:** Navigate to Email Templates

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/templates

**Step 2:** Customize templates

- **Confirm signup:** Email sent when user signs up
- **Magic Link:** For passwordless login
- **Change Email Address:** Confirmation email for email changes
- **Reset Password:** Password reset emails

**Default templates work fine** - customize only if needed for branding.

## Part 3: Enable GitHub OAuth (Optional)

### 3.1 Create GitHub OAuth Application

**Step 1:** Go to GitHub Developer Settings

- **URL:** https://github.com/settings/developers
- Click **"OAuth Apps"** in left sidebar
- Click **"New OAuth App"** button

**Step 2:** Fill in application details

| Field                          | Value                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| **Application name**           | `ScriptHammer` (or your preferred name)                      |
| **Homepage URL**               | `http://localhost:3000` (development) or your production URL |
| **Application description**    | (Optional) "Next.js template with authentication"            |
| **Authorization callback URL** | `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`    |

**Step 3:** Register application

- Click **"Register application"**
- You'll be redirected to the app details page

**Step 4:** Copy credentials

- Copy the **Client ID** (visible immediately)
- Click **"Generate a new client secret"**
- Copy the **Client Secret** (shown once - save it now!)

### 3.2 Configure GitHub in Supabase

**Step 1:** Navigate to Auth Providers

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/providers

**Step 2:** Find and enable GitHub

- Scroll to **"GitHub"** provider
- Click to expand settings
- Toggle **"Enable GitHub provider"** to **ON**

**Step 3:** Paste GitHub credentials

- **Client ID:** Paste from GitHub OAuth app (Step 3.1.4)
- **Client Secret:** Paste from GitHub OAuth app (Step 3.1.4)

**Step 4:** Save changes

- Click **"Save"** at the bottom

**Step 5:** Verify callback URL matches

- Ensure the callback URL in Supabase matches what you entered in GitHub:
  - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`

## Part 4: Enable Google OAuth (Optional)

### 4.1 Create Google OAuth Application

**Step 1:** Go to Google Cloud Console

- **URL:** https://console.cloud.google.com/apis/credentials
- Select your project or create a new one

**Step 2:** Create OAuth 2.0 Client ID

- Click **"+ CREATE CREDENTIALS"**
- Select **"OAuth client ID"**
- If prompted, configure the OAuth consent screen first

**Step 3:** Configure OAuth consent screen (if needed)

- **User Type:** External (for public apps)
- **App name:** ScriptHammer
- **User support email:** Your email
- **Developer contact information:** Your email
- Click **"Save and Continue"**
- Skip **Scopes** (click "Save and Continue")
- Skip **Test users** (click "Save and Continue")

**Step 4:** Create OAuth Client ID

- **Application type:** Web application
- **Name:** ScriptHammer
- **Authorized redirect URIs:** Click **"+ ADD URI"**
  - Add: `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
- Click **"CREATE"**

**Step 5:** Copy credentials

- Copy the **Client ID**
- Copy the **Client Secret**

### 4.2 Configure Google in Supabase

**Step 1:** Navigate to Auth Providers

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/providers

**Step 2:** Find and enable Google

- Scroll to **"Google"** provider
- Click to expand settings
- Toggle **"Enable Google provider"** to **ON**

**Step 3:** Paste Google credentials

- **Client ID:** Paste from Google Cloud Console (Step 4.1.5)
- **Client Secret:** Paste from Google Cloud Console (Step 4.1.5)

**Step 4:** Save changes

- Click **"Save"** at the bottom

## Part 5: Configure Authentication Settings

### 5.1 Site URL Configuration

**Step 1:** Navigate to Auth settings

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/url-configuration

**Step 2:** Set Site URL

- **Development:** `http://localhost:3000`
- **Production:** Your deployed URL (e.g., `https://scripthammer.github.io/ScriptHammer`)

**Step 3:** Add Redirect URLs

- Click **"Add redirect URL"** for each environment:
  - `http://localhost:3000/**` (development)
  - `https://scripthammer.github.io/ScriptHammer/**` (production)

### 5.2 Email Auth Settings

**Step 1:** Navigate to Auth settings

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/settings/auth

**Step 2:** Configure security settings

| Setting                               | Recommended Value | Reason                                      |
| ------------------------------------- | ----------------- | ------------------------------------------- |
| **Enable email confirmations**        | ON                | Verify user owns the email                  |
| **Enable email change confirmations** | ON                | Prevent account takeover                    |
| **Secure email change**               | ON                | Require current password to change email    |
| **Allow users without an email**      | OFF               | Email required for notifications & recovery |

**Step 3:** Session settings (optional)

- **JWT expiry:** 3600 seconds (1 hour) - default is fine
- **Refresh token rotation:** ON - prevents token theft

## Part 6: Test Authentication

### 6.1 Test Email/Password Sign-Up

**Step 1:** Start development server

```bash
docker compose exec scripthammer pnpm run dev
```

**Step 2:** Navigate to sign-up page

- **URL:** http://localhost:3000/sign-up

**Step 3:** Create test account

- Enter email: `test@example.com`
- Enter password: `TestPassword123!`
- Click **"Sign Up"**

**Step 4:** Check email for verification

- Check inbox for confirmation email from Supabase
- Click the verification link
- You should be redirected to the app

**Step 5:** Verify user was created

- Navigate to: https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/users
- You should see `test@example.com` in the user list

### 6.2 Test OAuth Sign-In (GitHub/Google)

**Step 1:** Navigate to sign-in page

- **URL:** http://localhost:3000/sign-in

**Step 2:** Click OAuth button

- Click **"Sign in with GitHub"** or **"Sign in with Google"**

**Step 3:** Authorize application

- You'll be redirected to GitHub/Google
- Click **"Authorize"** to grant access

**Step 4:** Verify redirect

- You should be redirected back to: http://localhost:3000/profile
- You should see your profile information

**Step 5:** Check Supabase users

- Navigate to: https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/users
- You should see your GitHub/Google account in the user list

## Verification via Management API

The fastest way to confirm OAuth is actually wired up correctly — without trial-and-error in the dashboard — is to query the Supabase Management API directly. This is the exact check that would have caught [issue #85](https://github.com/TortoiseWolfe/ScriptHammer/issues/85): OAuth Client IDs left as the literal strings `placeholder_google_client_id` / `placeholder_github_client_id` for weeks, surfacing only as `Error 401: invalid_client` when a user clicked "Continue with Google."

**Prerequisites:**

- `SUPABASE_ACCESS_TOKEN` in your `.env` — generate at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
- `jq` installed (already in the Docker container; on host: `apt install jq` / `brew install jq`)

**Run the check:**

```bash
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/<YOUR-PROJECT-REF>/config/auth" \
  | jq '{
      google_enabled: .external_google_enabled,
      google_client_id: .external_google_client_id,
      github_enabled: .external_github_enabled,
      github_client_id: .external_github_client_id,
      site_url,
      uri_allow_list
    }'
```

**Expected output (correctly configured):**

```json
{
  "google_enabled": true,
  "google_client_id": "123456789012-abc.apps.googleusercontent.com",
  "github_enabled": true,
  "github_client_id": "Iv1.0123456789abcdef",
  "site_url": "https://yourdomain.com",
  "uri_allow_list": "https://yourdomain.com/auth/callback"
}
```

**Red flags:**

- `google_client_id` is the literal string `placeholder_google_client_id` — Google OAuth is misconfigured. Re-do [Part 4](#part-4-enable-google-oauth-optional).
- `github_client_id` is the literal string `placeholder_github_client_id` — GitHub OAuth is misconfigured. Re-do [Part 3](#part-3-enable-github-oauth-optional).
- `google_client_id` does NOT end in `.apps.googleusercontent.com` — not a real Google OAuth client ID.
- `github_client_id` is not 20-character hex (or `Iv1.` prefix for GitHub Apps) — not a real GitHub OAuth client ID.
- `site_url` is `http://localhost:3000` but you've deployed to production — update via [auth URL configuration](https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/url-configuration).
- `uri_allow_list` is empty but you've deployed to production — must include your production callback URL.

This one-line check is fast enough to run as part of every deploy verification.

## Part 6.5: Bot Protection for Sign-Up (CAPTCHA) — #353

**Why this exists.** The sign-up form already rate-limits, but that limit is keyed
on the **email address** (`checkRateLimit(email, 'sign_up')`) — a bot that uses a
fresh address per attempt never trips it. That is not hypothetical: with no
CAPTCHA, 17 accounts were created here in a 7-day window, **13 of which belonged
to people who never asked for one**, meaning this project's domain sent them
mail. An open sign-up form is a free mail relay; CAPTCHA is the control that
makes each attempt cost something.

The client half ships **inert**: with no site key set, no widget renders, no
token is sent, and behaviour is exactly as before. Forks are unaffected until
they opt in.

### 6.5.1 Order matters — do NOT flip the switch first

Supabase rejects a token-less sign-up the instant `SECURITY_CAPTCHA_ENABLED` is
true. If you enable it before a build carrying the site key is live, **every
sign-up breaks, including yours**. Always:

1. Deploy a build that has `NEXT_PUBLIC_CAPTCHA_SITE_KEY` set, **then**
2. enable it in Supabase.

To roll back, unset the site key and disable it in Supabase — in that order.

### 6.5.2 Create the Turnstile site

We use **Cloudflare Turnstile** (free, unlimited, and usually invisible to real
users, so legitimate sign-ups pay nothing). Supabase also supports hCaptcha.

1. <https://dash.cloudflare.com> → **Turnstile** → **Add site**
2. Add your domain(s), including any preview host you sign up from
3. Copy the **site key** (public) and **secret key** (private)

### 6.5.3 Wire it up

| Value      | Goes where                                                                                    | Notes                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site key   | `NEXT_PUBLIC_CAPTCHA_SITE_KEY` — repo **Actions variable** (not a secret) + your local `.env` | Public; ships in the page HTML, so `vars.` not `secrets.`, matching the other public `NEXT_PUBLIC_*` config. `deploy.yml` passes it to the build |
| Secret key | Supabase → Auth → **Attack Protection** → CAPTCHA                                             | **Never** commit; never send to the browser                                                                                                      |

### 6.5.3 Preflight — run this BEFORE flipping the flag

`SECURITY_CAPTCHA_ENABLED` is **global to auth**, not scoped to sign-up. It
gates sign-in, password recovery and resend as well. Turning it on while any one
link is wrong locks every existing user out of the product.

That is not hypothetical: the flag was once switched on while only the sign-up
form sent a token, and every sign-in immediately began failing with
`captcha protection: request disallowed (no captcha_token found)`. The mistake
was not carelessness — it was that the change was verified by probing sign-**up**,
the single path that happened to work.

```bash
TURNSTILE_SECRET=0x... docker compose exec -T scripthammer \
  node scripts/check-captcha.mjs
```

It verifies the two links that fail silently:

- **The site key reached the deployed bundle.** `NEXT_PUBLIC_*` is inlined at
  **build** time, so setting the repo variable alone changes nothing — the
  workflow has to pass it into the build step. `deploy.yml` does; nothing else
  does, deliberately.
- **The secret is a real Turnstile secret**, via Cloudflare's `siteverify`.
  This cannot be checked by reading the value back: Supabase returns write-only
  secrets as **SHA-256 hashes** (`smtp_pass` and the OAuth secrets look exactly
  the same), so the stored value always fails verification whether it is right
  or wrong. Only the plaintext from the Cloudflare dashboard proves it. A wrong
  secret refuses **every** auth request even when the user's token is valid.

Two further points the script deliberately leaves alone:

- **Domain allowlisting** must be proven _differentially_ — load the widget from
  a bogus origin and confirm error **`110200`**, then from the real origin and
  confirm no error. Without the bogus control, "no error" is unfalsifiable,
  because a broken check reports exactly the same thing.
- **A headless browser legitimately receives no token.** Turnstile exists to
  withhold tokens from automation, so a container run getting none proves
  nothing. Do not treat that as a failure, and do not "fix" it by weakening the
  widget. Confirm the real flows in an ordinary browser once the flag is on.

Then set the provider to **Turnstile** and enable it. In
`scripts/supabase/auth-config.json`, change:

```json
"security_captcha_enabled": true,
"security_captcha_provider": "turnstile",
```

and apply with `pnpm supabase:auth-config --apply`. Those two keys are tracked
precisely so the drift gate (`auth-config-drift.yml`) fails if anything silently
turns protection off later.

> **The gate only guards what it knows.** `computeDiff` iterates
> `Object.keys(desired)`, so a key absent from `auth-config.json` is invisible to
> it — which is exactly why the missing CAPTCHA went unnoticed. If you add a
> security-relevant auth setting, add it to that file too.

The same audit found a second instance, so the **outbound mail identity** is now
tracked as well: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_admin_email` and
`smtp_sender_name`. Previously nothing would have noticed if the sending domain
or from-address were silently repointed — a phishing-shaped change to the one
channel users are told to trust.

**`smtp_pass` is deliberately NOT tracked.** It is the Resend credential; it
lives only in Supabase Auth's config, server-side. It must never enter a
committed file — gitleaks would block the commit, correctly. Only non-secret
identity fields belong here.

> **Type gotcha:** `smtp_port` is a **string** (`"587"`) in the Management API,
> not a number. Writing `587` shows permanent false drift. When adding a key,
> read the live value first and match its JSON type exactly.

> **The variable alone does nothing.** `NEXT_PUBLIC_*` is inlined at build time,
> so `deploy.yml` must pass it into the build step — it does, but a fork adding
> the variable without that line would ship an inert widget and wonder why.
> Deliberately wired into `deploy.yml` ONLY: `accessibility.yml` would put
> Cloudflare's iframe under Pa11y, and `e2e.yml` does not need it because the
> form-submitting sign-up tests are unconditionally skipped (#361).

### 6.5.4 What this does and doesn't protect

- The widget is **not** a security boundary on its own — a bot can skip the UI
  and POST directly. The control that matters is Supabase verifying the token
  server-side, i.e. `SECURITY_CAPTCHA_ENABLED = true`.
- It protects the **public form only**. Tests create users through the admin
  API, which bypasses CAPTCHA by design — so CI is unaffected.

### 6.5.5 Effect on the test suites

| Suite                                     | Target             | Effect                                                                                                              |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `signup-mailer.yml` (real form + Mailpit) | **local** Supabase | Unaffected — CAPTCHA is not enabled locally. **This is where real-form sign-up coverage lives once CAPTCHA is on.** |
| `production.smoke.spec.ts`                | prod               | Unaffected — read-only, creates no users                                                                            |
| `user-registration.spec.ts`               | cloud              | Validation cases unaffected; the one full-registration case is already `test.skip`                                  |
| `sign-up.spec.ts`                         | cloud              | **Two cases submit the real form and are explicitly skipped** via `skipIfCaptchaProtected()`                        |

Nothing goes red — but the last row is the one that matters, and it is worth
understanding _why_ it needed an explicit skip rather than being left alone.
Both cases would otherwise have "passed" dishonestly:

- `should complete sign-up with valid credentials` catches any `.alert-error`
  and calls `test.skip(true, 'Sign-up error: …')`. The challenge prompt would
  have been swallowed into a vague skip — a test that silently stops testing
  while CI stays green.
- `should show error when signing up with existing email` accepts "an error is
  visible" as success, so it would have gone green on the CAPTCHA message
  rather than the duplicate-email error it claims to assert — a false green.

`skipIfCaptchaProtected()` detects the rendered widget, so it is
self-configuring (no env var to remember) and its skip reason names #353 and
points at where the coverage actually runs.

The sign-up gate lives in `handleSubmit`, **not** in the button's `disabled`
attribute. That is deliberate twice over: a disabled button is a dead end if
Turnstile fails to load (blocked script, CSP regression, offline), and it would
have broken the validation E2E cases that click **Sign Up** expecting a
client-side error.

### 6.5.6 CSP

Turnstile needs `https://challenges.cloudflare.com` in **three** CSP directives —
`script-src` (loader), `frame-src` (the challenge iframe) and `connect-src`. Miss
any one and the widget fails _silently_ in production. See the policy in
`src/app/layout.tsx` (shipped as a meta tag, since static export has no response
headers).

## Part 7: Environment Variables

### 7.1 Required Environment Variables

Create or update `.env.local` in project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Get anon key from: https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/settings/api
```

### 7.2 Get Supabase API Keys

**Step 1:** Navigate to API settings

- **URL:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/settings/api

**Step 2:** Copy API keys

- **Project URL:** Already in `.env.local` above
- **anon/public key:** Copy and paste into `.env.local`
- **service_role key:** DO NOT expose in client code (server-side only)

**Step 3:** Restart development server

```bash
# Exit dev server (Ctrl+C)
docker compose exec scripthammer pnpm run dev
```

## Troubleshooting

### Issue: "Unsupported provider: provider is not enabled"

**Solution:** Email/GitHub/Google provider not enabled in Supabase

- Go to: https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/providers
- Enable the provider you're trying to use
- Click **"Save"**

### Issue: "Invalid redirect URL"

**Solution:** Redirect URL not whitelisted

- Go to: https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/url-configuration
- Add your URL to **"Redirect URLs"**
- Format: `http://localhost:3000/**` (note the `/**` wildcard)

### Issue: "Email not confirmed"

**Solution:** User hasn't verified email

- Check email inbox for verification link
- Or disable email confirmation temporarily:
  - Go to: https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/settings/auth
  - Toggle **"Enable email confirmations"** to OFF (not recommended for production)

### Issue: GitHub OAuth callback error

**Solution:** Callback URL mismatch

- Verify GitHub OAuth app callback URL matches:
  - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
- Check both GitHub app settings and Supabase provider settings

### Issue: Google OAuth "redirect_uri_mismatch"

**Solution:** Redirect URI not configured in Google Cloud

- Go to: https://console.cloud.google.com/apis/credentials
- Edit your OAuth 2.0 Client ID
- Add authorized redirect URI:
  - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`

## Reference Links

### Supabase Dashboard

- **Project Home:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>
- **SQL Editor:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/sql
- **Auth Providers:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/providers
- **Auth Users:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/users
- **API Settings:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/settings/api
- **URL Configuration:** https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/url-configuration

### OAuth Provider Setup

- **GitHub Developer Settings:** https://github.com/settings/developers
- **Google Cloud Console:** https://console.cloud.google.com/apis/credentials

### Supabase Documentation

- **Auth Providers Guide:** https://supabase.com/docs/guides/auth/social-login
- **Email Auth Guide:** https://supabase.com/docs/guides/auth/auth-email
- **Row Level Security:** https://supabase.com/docs/guides/auth/row-level-security

## Next Steps

After completing authentication setup:

1. **Test all auth flows** (email, GitHub, Google)
2. **Configure email templates** for branding (optional)
3. **Set up password policies** (min length, complexity)
4. **Enable MFA** for extra security (optional)
5. **Configure rate limiting** to prevent abuse
6. **Set up monitoring** for failed login attempts

---

**Documentation Version:** 1.0.0
**Last Updated:** 2025-10-05
**Related PRPs:** PRP-016 (User Authentication), PRP-015 (Payment Integration)
