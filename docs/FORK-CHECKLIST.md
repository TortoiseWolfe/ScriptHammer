# Fork Setup Checklist

**Audience**: someone who just forked ScriptHammer (or used "Use this template") and wants to get the app fully running with their own accounts on every integrated service.

**Goal**: a single page that tells you which services this template integrates with, which are required vs. optional, what to set up first, and exactly where to go for each.

If you've never touched the repo before, start at the top and work down. Each step links to a deeper guide where you need it.

---

## Setup order (do these in order)

### 1. Rebrand the repo (~15 min, of which 71s is the script)

ScriptHammer ships with 932 files that reference its own name, theme, and Docker service. The included `scripts/rebrand.sh` rewrites them all for you.

- **Run**: `./scripts/rebrand.sh <YourProjectName> <YourGitHubUser> "<one-line description>" --icon path/to/mark.svg --preserve-ssh`
  - Example: `./scripts/rebrand.sh MyCoolApp myuser "My awesome app" --icon mark.svg --preserve-ssh`
  - **`--icon` or `--no-icon` is required** — the script refuses without one. A rebrand cannot draw a
    logo, and skipping it silently is how this template's mark reached two live sites (#659, #898).
    Accepts `.svg`, `.png`, `.webp`. Use a symbol, not a wordmark: `favicon.ico` carries
    a **16px** frame, and 16px is 256 pixels — interior text, hairline strokes and more
    than ~3 tonal areas do not survive it (#906). If your mark needs its detail, pass a
    simplified second one with `--icon-small <mark>`, used for everything at or below
    32px. Nothing can check legibility for you; open the .ico and look.
  - **Run it inside the container** — `docker compose exec <project> ./scripts/rebrand.sh …`. Icon
    generation needs `sharp`, which lives in a named Docker volume and is absent from the host, so
    `--icon` fails on the host _after_ replacing `public/favicon.svg`.
  - `--preserve-ssh` keeps your `git@github.com:…` remote in SSH format (skip if you cloned via HTTPS).
    - **`--keep-cname` on a fresh fork is refused** (#995). The configured domain is still
      _this_ template's, and keeping it would publish a hostname you do not own. Without the
      flag the script sets `customDomain` to `null` in `config/deployment.json`, which is what
      you want until you actually own a domain: a configured domain tells the build to serve
      from an apex, which drops the GitHub Pages basePath and 404s every asset at the URL you
      were actually given. Set that key to your hostname on the day you point DNS at it —
      `public/CNAME` is generated from it (#980), so there is no file to add or delete.
    - **The template's blog posts are removed**, all but one. They are this project's
      writing — including personal essays and a deliberate bad-SEO test fixture — and a
      sweep that only swaps the brand would republish them, indexed and in your feed, as
      though you had written them. A single `hello-world` post is kept; it documents the
      frontmatter format and then tells you to delete it. Pass `--keep-blog` to keep the
      lot; you rarely want that.
  - Run `./scripts/rebrand.sh --help` for the full flag list.
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
- Production build succeeds: `docker compose run --rm builder pnpm run build`

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

## What you need in your hand

**Before running `rebrand.sh`: nothing.** It takes three arguments and an icon flag —
`<PROJECT_NAME> <OWNER> "<DESCRIPTION>"` plus `--icon <mark>` or `--no-icon`. No keys, no
accounts, no `.env`.

Everything below is for the **deployed** site, and it goes in one place:

> GitHub → your repo → **Settings → Secrets and variables → Actions**

**That page has two tabs, and which one you use is load-bearing.** `deploy.yml` reads Supabase
from `vars.*`. Put those in **Secrets** and they arrive as empty strings: the deploy goes green
and the site ships with no backend, with nothing anywhere saying so.

`.env` is a different thing entirely — local development only, gitignored, and never read by a
deploy. Copy it from `.env.example` after rebranding, so it picks up your project's values.

Only the first row stops a site existing. **Everything else fails silently**, which is why the
whole list is here rather than the four that usually matter.

<!-- env-inventory:start -->

#### Stops the app working

| Value                           | Tab      | Without it                                                                                                                       |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Variable | No accounts, payments or messaging. The site builds and shows a "not configured" banner.                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Variable | Same. Both are VARIABLES — put them in Secrets and they arrive empty, the deploy goes green, and the site ships with no backend. |

#### Makes the site advertise the wrong address

| Value                                  | Tab      | Without it                                                                                                                                            |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_DEPLOY_URL`               | Variable | Canonicals, sitemap, robots.txt and og:image fall back to a github.io origin. retain-previous-assets.mjs crawls the TEMPLATE's site instead of yours. |
| `NEXT_PUBLIC_SITE_URL`                 | Variable | Same family: the origin the app reports as its own.                                                                                                   |
| `NEXT_PUBLIC_BASE_URL`                 | Variable | Same family.                                                                                                                                          |
| `NEXT_PUBLIC_PROJECT_NAME`             | Variable | Overrides the name detect-project.js derives from the git remote. Usually unnecessary.                                                                |
| `NEXT_PUBLIC_PROJECT_OWNER`            | Variable | Overrides the owner detect-project.js derives from the git remote.                                                                                    |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Variable | The Search Console meta tag is skipped, so verification never ships and nothing says so (#917).                                                       |

#### Author identity on posts and the about surface

| Value                         | Tab      | Without it                                  |
| ----------------------------- | -------- | ------------------------------------------- |
| `NEXT_PUBLIC_AUTHOR_NAME`     | Variable | Bylines fall back to the git owner.         |
| `NEXT_PUBLIC_AUTHOR_EMAIL`    | Variable | Contact link on author surfaces is omitted. |
| `NEXT_PUBLIC_AUTHOR_AVATAR`   | Variable | No author image.                            |
| `NEXT_PUBLIC_AUTHOR_BIO`      | Variable | No author bio.                              |
| `NEXT_PUBLIC_AUTHOR_ROLE`     | Variable | No role line.                               |
| `NEXT_PUBLIC_AUTHOR_GITHUB`   | Variable | Social link omitted.                        |
| `NEXT_PUBLIC_AUTHOR_LINKEDIN` | Variable | Social link omitted.                        |
| `NEXT_PUBLIC_AUTHOR_TWITTER`  | Variable | Social link omitted.                        |
| `NEXT_PUBLIC_AUTHOR_BLUESKY`  | Variable | Social link omitted.                        |
| `NEXT_PUBLIC_AUTHOR_MASTODON` | Variable | Social link omitted.                        |
| `NEXT_PUBLIC_AUTHOR_TWITCH`   | Variable | Social link omitted.                        |
| `NEXT_PUBLIC_AUTHOR_WEBSITE`  | Variable | Social link omitted.                        |

#### Payments

| Value                                | Tab      | Without it                 |
| ------------------------------------ | -------- | -------------------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Variable | Card checkout unavailable. |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID`       | Secret   | PayPal button unavailable. |
| `NEXT_PUBLIC_CASHAPP_CASHTAG`        | Variable | Cash App option hidden.    |
| `NEXT_PUBLIC_CHIME_SIGN`             | Variable | Chime option hidden.       |

#### Contact and email

| Value                              | Tab      | Without it                                                                                                                                                     |
| ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` | Secret   | The contact form cannot deliver. Production shipped this empty once, leaving /contact/ with no working channel (#784).                                         |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`   | Secret   | EmailJS fallback disabled.                                                                                                                                     |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID`   | Variable | EmailJS fallback disabled.                                                                                                                                     |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`  | Variable | EmailJS fallback disabled.                                                                                                                                     |
| `NEXT_PUBLIC_SUPPORT_EMAIL`        | Variable | No mailto is rendered when the form cannot deliver. Empty by default ON PURPOSE — a hardcoded address would put the template maintainer's inbox on every fork. |

#### Analytics, monitoring and extras

| Value                             | Tab      | Without it                                                                                                                                                              |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`   | Variable | No Google Analytics.                                                                                                                                                    |
| `NEXT_PUBLIC_PAGESPEED_API_KEY`   | Secret   | /status falls back to the unauthenticated PageSpeed quota, so its live scores may read 'over the anonymous quota'. It stopped the deploy until #987; it no longer does. |
| `NEXT_PUBLIC_SENTRY_DSN`          | Secret   | No error reporting.                                                                                                                                                     |
| `NEXT_PUBLIC_DISQUS_SHORTNAME`    | Variable | Blog comments disabled.                                                                                                                                                 |
| `NEXT_PUBLIC_CALENDAR_PROVIDER`   | Variable | Scheduling embed disabled.                                                                                                                                              |
| `NEXT_PUBLIC_CALENDAR_URL`        | Variable | Scheduling embed disabled.                                                                                                                                              |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY`    | Variable | Sign-up captcha disabled.                                                                                                                                               |
| `NEXT_PUBLIC_SITE_TWITTER_HANDLE` | Variable | twitter:site omitted from cards.                                                                                                                                        |
| `NEXT_PUBLIC_SOCIAL_PLATFORMS`    | Variable | Share buttons fall back to defaults.                                                                                                                                    |

<!-- env-inventory:end -->

### Taking a fix from the template later

A repo created with **Use this template** shares no git history with the template, so you cannot
merge from it by default — but you can still fetch it:

```bash
git remote add upstream https://github.com/TortoiseWolfe/ScriptHammer.git
git fetch upstream
git cherry-pick <commit-sha>
```

Cherry-pick works across unrelated histories. Where the rebrand renamed something, you get
ordinary **conflict markers** to resolve rather than a flat refusal — which is the difference
between a five-minute merge and rewriting the change by hand. Hand-rewriting is how a template
literal became a literal string in one fork, canonicalising seven pages to `/docs/$%7Bslug%7D/`.

### Editing a blog post does nothing until you regenerate the index

`public/blog/*.md` is not what the site serves. The blog, the sitemap, the RSS feed and the
JSON feed all read `src/lib/blog/blog-data.json`, a committed artifact — and generating it is
deliberately not part of the build. So adding, editing **or deleting** a post has no effect
until you run:

```bash
docker compose exec <project> pnpm generate:blog
```

and commit the resulting diff. Deleting a post file is the surprising one: without this the
post stays live, still in the sitemap, still in the feed.
`scripts/__tests__/blog-index-matches-disk.test.js` fails when the two sides disagree, so CI
catches it — but it is quicker to remember than to be told.

### The hosted E2E lane is switched off in your fork until you claim it

Your PRs get their E2E coverage from `e2e-local.yml`, which brings up a Supabase per
runner and needs no secrets. The second lane, `e2e.yml`, runs ~24 jobs against a real
hosted project, and it is what exhausted a free tier here.

`scripts/ci/e2e-budget-guard.mjs` counts runs **in the repository it is running in**, so
a fresh fork's counter starts at zero and the cost guard would wave through the
expensive lane precisely when nobody has thought about quota yet. It therefore refuses
to meter a backend it cannot identify: with `vars.SUPABASE_PROJECT_REF` unset, or set to
a project the script's constants do not describe, the lane is blocked.

To adopt it for your own backend, set both repository variables together:

| Variable                         | Value                                        |
| -------------------------------- | -------------------------------------------- |
| `E2E_BUDGET_BACKEND_PROJECT_REF` | your Supabase project ref                    |
| `E2E_BUDGET_BACKEND_EPOCH`       | ISO 8601 date that project came into service |

Limits are `E2E_BUDGET_DAY` / `E2E_BUDGET_MONTH` (10 and 30 by default — sized for the
free tier, not for you). An epoch without a ref moves the counting window without
establishing whose window it is, which is why they go together.

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
