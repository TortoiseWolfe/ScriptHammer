# Fork Setup Checklist

**Audience**: someone who just forked ScriptHammer (or used "Use this template") and wants to get the app fully running with their own accounts on every integrated service.

**Goal**: a single page that tells you which services this template integrates with, which are required vs. optional, what to set up first, and exactly where to go for each.

If you've never touched the repo before, start at the top and work down. Each step links to a deeper guide where you need it.

---

## Setup order (do these in order)

### 1. Rebrand the repo (~5 min)

ScriptHammer ships with 200+ files that reference its own name, theme, and Docker service. The included `scripts/rebrand.sh` rewrites them all for you.

- **Run**: `./scripts/rebrand.sh` (interactive — you'll be asked for your project name)
- **Full guide**: [`docs/FORKING.md` — Quick Start](FORKING.md#quick-start-5-minutes)
- **Why it matters**: skipping this leaves your fork branded as "ScriptHammer" everywhere.

### 2. Create your Supabase project (~10 min)

Supabase is the **only required external service**. Without it, auth, messaging, and payments don't work. The free tier is sufficient for development.

- **Sign up** at [supabase.com/dashboard](https://supabase.com/dashboard) — sign in with GitHub (recommended)
- **Create a new project** — pick a strong DB password, save it
- **Wait 2-3 minutes** for the project to provision
- **Note down your project ref** — the alphanumeric code in your dashboard URL (`https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>`)

### 3. Run the database migration (~5 min)

The migration creates all the tables (auth, messaging, payments) the template needs.

- **Full guide**: [`docs/AUTH-SETUP.md` — Part 1: Database Setup](AUTH-SETUP.md#part-1-database-setup)
- **Why it matters**: without this, signing up returns "relation does not exist" errors.

### 4. Configure your auth providers (~15-30 min)

ScriptHammer supports email/password plus OAuth (GitHub, Google). Email/password is required for messaging features; OAuth is optional but recommended.

| Provider           | Required?   | Where to set it up                                                                                                                                                           |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email/Password** | ✅ Required | [`AUTH-SETUP.md` Part 2](AUTH-SETUP.md#part-2-enable-emailpassword-authentication)                                                                                           |
| **GitHub OAuth**   | Optional    | Create a [GitHub OAuth App](https://github.com/settings/developers) → follow [`AUTH-SETUP.md` Part 3](AUTH-SETUP.md#part-3-enable-github-oauth-optional)                     |
| **Google OAuth**   | Optional    | Create a [Google Cloud OAuth client](https://console.cloud.google.com/apis/credentials) → follow [`AUTH-SETUP.md` Part 4](AUTH-SETUP.md#part-4-enable-google-oauth-optional) |

After setup, **verify** your OAuth client IDs are real values (not the literal string `placeholder_google_client_id`) by running the [Management API check in `AUTH-SETUP.md`](AUTH-SETUP.md#verification-via-management-api). This single command would have caught issue #85.

### 5. Wire Supabase keys into `.env` (~2 min)

- Copy `.env.example` to `.env` if you haven't already (`cp .env.example .env`)
- From [your Supabase dashboard's API settings](https://supabase.com/dashboard), copy the **Project URL** and **anon/public key**
- Paste into `.env`:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...your-anon-key
  ```
- Restart Docker (`docker compose down && docker compose up`) — the [SetupBanner](../src/components/SetupBanner/SetupBanner.tsx) should disappear once these are set.

### 6. (Optional) Set up payment providers (~30-60 min)

If you want `/payment-demo` and friends to work against live sandbox APIs:

- **Stripe** + **PayPal** end-to-end setup: [`docs/PAYMENT-DEPLOYMENT.md`](PAYMENT-DEPLOYMENT.md) (full 256-line walkthrough including Edge Function deployment)
- **Short version** also lives in [`README.md` — Payment Integration Setup](../README.md#-payment-integration-setup)
- Server secrets (`STRIPE_SECRET_KEY`, etc.) go in **Supabase Vault**, not `.env` — this is a static-export template with no Next.js server runtime

### 7. (Optional) Set up email failover

The contact form uses Web3Forms as primary with EmailJS as backup:

- **Web3Forms** — sign up at [web3forms.com](https://web3forms.com) (email-only signup, no credit card). Copy your access key into `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`.
- **EmailJS** (optional backup) — see [`docs/features/emailjs-integration.md`](features/emailjs-integration.md) for the failover setup.

### 8. (Optional) Set up analytics

- **Google Analytics 4** — create a property at [analytics.google.com](https://analytics.google.com/) → copy the Measurement ID (format `G-XXXXXXXXXX`) into `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Code is already shipped, theme-change events fire automatically. Issue #31 closed.

### 9. Final verification

- Run the [verification checklist in `docs/FORKING.md`](FORKING.md#verification-checklist) (12 items)
- All E2E tests pass: `docker compose exec scripthammer pnpm exec playwright test`
- Production build succeeds: `docker compose exec scripthammer pnpm run build`

---

## Service matrix

Every external service this template integrates with, in one table:

| Service                          | Required?   | Env vars                                                                                                       | Setup doc / signup link                                                                                                                                                      |
| -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase**                     | ✅ Required | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                    | [supabase.com/dashboard](https://supabase.com/dashboard) → [`AUTH-SETUP.md`](AUTH-SETUP.md)                                                                                  |
| **Email/Password auth**          | ✅ Required | (handled by Supabase)                                                                                          | [`AUTH-SETUP.md` Part 2](AUTH-SETUP.md#part-2-enable-emailpassword-authentication)                                                                                           |
| **GitHub OAuth**                 | Optional    | (Supabase dashboard)                                                                                           | [github.com/settings/developers](https://github.com/settings/developers) → [`AUTH-SETUP.md` Part 3](AUTH-SETUP.md#part-3-enable-github-oauth-optional)                       |
| **Google OAuth**                 | Optional    | (Supabase dashboard)                                                                                           | [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) → [`AUTH-SETUP.md` Part 4](AUTH-SETUP.md#part-4-enable-google-oauth-optional) |
| **Stripe payments**              | Optional    | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`.env`) + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (Supabase Vault) | [dashboard.stripe.com](https://dashboard.stripe.com) → [`PAYMENT-DEPLOYMENT.md`](PAYMENT-DEPLOYMENT.md)                                                                      |
| **PayPal subscriptions**         | Optional    | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (`.env`) + `PAYPAL_CLIENT_SECRET` + `PAYPAL_WEBHOOK_ID` (Supabase Vault)        | [developer.paypal.com](https://developer.paypal.com) → [`PAYMENT-DEPLOYMENT.md`](PAYMENT-DEPLOYMENT.md)                                                                      |
| **Web3Forms (contact form)**     | Optional    | `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`                                                                             | [web3forms.com](https://web3forms.com) — paste email, get key                                                                                                                |
| **EmailJS (email failover)**     | Optional    | `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`, `NEXT_PUBLIC_EMAILJS_SERVICE_ID`, `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`          | [emailjs.com](https://www.emailjs.com) → [`docs/features/emailjs-integration.md`](features/emailjs-integration.md)                                                           |
| **Resend (transactional email)** | Optional    | `RESEND_API_KEY` (Supabase Vault)                                                                              | [resend.com](https://resend.com) — sign up, verify domain, generate API key                                                                                                  |
| **Google Analytics 4**           | Optional    | `NEXT_PUBLIC_GA_MEASUREMENT_ID`                                                                                | [analytics.google.com](https://analytics.google.com/) — create GA4 property, copy `G-...` ID                                                                                 |
| **PageSpeed Insights API**       | Optional    | `NEXT_PUBLIC_PAGESPEED_API_KEY`                                                                                | [developers.google.com/speed/docs/insights/v5/get-started](https://developers.google.com/speed/docs/insights/v5/get-started)                                                 |
| **Calendar (Calendly, etc.)**    | Optional    | `NEXT_PUBLIC_CALENDAR_PROVIDER`, `NEXT_PUBLIC_CALENDAR_URL`                                                    | [`docs/features/calendar-integration.md`](features/calendar-integration.md)                                                                                                  |
| **Disqus comments**              | Optional    | `NEXT_PUBLIC_DISQUS_SHORTNAME`                                                                                 | [disqus.com](https://disqus.com) — register a shortname for your site                                                                                                        |
| **Cash App**                     | Optional    | `NEXT_PUBLIC_CASHAPP_CASHTAG`                                                                                  | Just paste your `$cashtag` from Cash App settings                                                                                                                            |
| **Chime**                        | Optional    | `NEXT_PUBLIC_CHIME_SIGN`                                                                                       | Just paste your `$ChimeSign` from Chime profile                                                                                                                              |
| **Author / site metadata**       | Cosmetic    | `NEXT_PUBLIC_AUTHOR_*` (11 vars), `NEXT_PUBLIC_PROJECT_*`, `NEXT_PUBLIC_SITE_URL`                              | Edit `.env` directly — see [`.env.example`](../.env.example)                                                                                                                 |
| **Docker config**                | ✅ Required | `UID`, `GID`, `COMPOSE_PROJECT_NAME`                                                                           | Set in `.env` — see [`.env.example` lines 1-20](../.env.example)                                                                                                             |

---

## Common pitfalls

Things that have actually bitten contributors. Reading these saves you time.

### OAuth: don't leave `placeholder_*` strings in your Supabase config

This caused issue #85. When you create a Supabase project and don't fully configure OAuth, the Client ID field can end up containing the literal string `placeholder_google_client_id` or `placeholder_github_client_id`. The OAuth buttons surface a confusing `Error 401: invalid_client` instead of a useful error message.

**Catch it early**: run the [Management API verification in `AUTH-SETUP.md`](AUTH-SETUP.md#verification-via-management-api) — it prints your current Client IDs in one line. Real Google IDs end in `.apps.googleusercontent.com`; real GitHub IDs are 20-character hex strings. Anything else is a misconfig.

### Production deploys need `site_url` and `uri_allow_list` updated

By default Supabase sets `site_url` to `http://localhost:3000`. When you deploy to production:

- Update `site_url` to your production URL (e.g., `https://yourdomain.com`)
- Add your production callback URL to `uri_allow_list` (e.g., `https://yourdomain.com/auth/callback`)
- Both fields live at: `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/url-configuration`

Skipping this means OAuth round-trips work locally but fail in production with redirect-URL-mismatch errors.

### Don't commit `.env` — it's gitignored for a reason

`.env.example` is committed and contains only placeholders. `.env` is local-only and contains your real keys. If you accidentally `git add .env`, the pre-commit gitleaks hook will block the commit. Don't bypass it with `--no-verify`.

### Server secrets go in Supabase Vault, not `.env`

This template static-exports to GitHub Pages — there's no Next.js server runtime. Any env var without a `NEXT_PUBLIC_` prefix is unused by the client and must live in Supabase Vault if it's needed by Edge Functions (e.g., `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_SECRET`, `RESEND_API_KEY`).

Set them via: `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/settings/functions` → Edge Function Secrets, or via CLI: `docker compose exec scripthammer supabase secrets set KEY=value`.

### Don't run `pnpm install` on the host

The container runs as your user (UID/GID from `.env`), and installing locally creates a `node_modules` directory the container can't manage. If you accidentally run it: `docker compose down && docker compose run --rm scripthammer rm -rf node_modules && docker compose up`. Full rules in [`CLAUDE.md`](../CLAUDE.md#docker-first-development-mandatory).

---

## Where to get help

| Question                                             | Answer location                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| How does the rebrand script work?                    | [`docs/FORKING.md` — Rebrand](FORKING.md#what-the-rebrand-script-does)                             |
| How do I deploy to GitHub Pages?                     | [`docs/FORKING.md` — GitHub Pages](FORKING.md#github-pages-deployment)                             |
| How do I sync from upstream ScriptHammer?            | [`docs/FORKING.md` — Syncing with upstream](FORKING.md#syncing-with-upstream-scripthammer)         |
| How do I configure GitHub Actions secrets for CI/CD? | [`README.md` — GitHub Actions Secrets](../README.md#-github-actions-secrets)                       |
| Are my OAuth providers configured correctly?         | [`AUTH-SETUP.md` — Verification via Management API](AUTH-SETUP.md#verification-via-management-api) |
| Which features are shipped vs. partial?              | [`STATUS.md`](../STATUS.md)                                                                        |
| Where is the full feature list?                      | [`features/IMPLEMENTATION_ORDER.md`](../features/IMPLEMENTATION_ORDER.md)                          |
