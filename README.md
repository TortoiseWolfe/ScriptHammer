# ScriptHammer

**An accessible web platform with auth, payments, and encrypted messaging. Running live, and free to fork.**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/TortoiseWolfe/ScriptHammer)
[![Live App](https://img.shields.io/badge/Live-scripthammer.com-2ea44f)](https://www.scripthammer.com/)
[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG%202.1-AA%20Compliant-success)](https://www.w3.org/WAI/WCAG21/quickref/)
[![Stars](https://img.shields.io/github/stars/TortoiseWolfe/ScriptHammer?style=social)](https://github.com/TortoiseWolfe/ScriptHammer)

<p align="center">
  <img
    src="./docs/architecture/architecture-simple.png"
    alt="ScriptHammer architecture overview. Your code is built ahead of time by pnpm into a Next.js static export served from GitHub Pages, so there's no application server. In the browser, a React app with a service worker and local storage talks directly to a managed Supabase backend providing Postgres with Row-Level Security, auth, realtime, and file storage. Twelve Deno Edge Functions handle anything needing a secret, including payments, subscriptions, and email, and call out to Stripe, PayPal, and Resend, which webhook their results back."
    width="900">
</p>

<p align="center">
  <sub><b>How it fits together.</b> The <a href="./docs/architecture/architecture-detailed.png">full reference diagram</a> adds every table, Edge Function, and route. Or read <a href="./docs/architecture/README.md">the architecture guide</a>.</sub>
</p>

This is a real product, not a scaffold. It runs at [scripthammer.com](https://www.scripthammer.com/) with OAuth and email sign-in, Stripe and PayPal payments, end-to-end encrypted messaging, an admin surface, and an installable offline-capable app that meets WCAG AA.

You can also fork it and build your own thing on top. That takes about five minutes.

## Try it

|                       |                                                                       |
| --------------------- | --------------------------------------------------------------------- |
| **The app**           | [scripthammer.com](https://www.scripthammer.com/)                     |
| **Component library** | [scripthammer.com/storybook](https://www.scripthammer.com/storybook/) |
| **Status dashboard**  | [scripthammer.com/status](https://www.scripthammer.com/status)        |

## Run it locally

You need Docker and git. That's it. Local pnpm and npm aren't supported, because everything runs in the container.

```bash
git clone https://github.com/TortoiseWolfe/ScriptHammer.git
cd ScriptHammer
cp .env.example .env      # then set UID and GID: run  id -u && id -g
docker compose up         # first build takes 5 to 10 minutes
```

That gives you the dev server on http://localhost:3000. It runs without any accounts or API keys. Sign-in, payments, and messaging stay dark until you connect the services below.

<details>
<summary><b>Everyday commands</b></summary>

```bash
docker compose exec scripthammer pnpm run dev         # dev server
docker compose exec scripthammer pnpm test            # unit tests
docker compose exec scripthammer pnpm run storybook   # component library

docker compose down && docker compose up --build      # clean restart
```

Production builds get their own container, so they never fight the dev server for the build directory:

```bash
docker compose run --rm builder pnpm build
```

</details>

## Fork it

```bash
gh repo fork TortoiseWolfe/ScriptHammer --clone
cd YourProjectName
./scripts/rebrand.sh MyProject myusername "My project description" --icon path/to/your-mark.svg
cp .env.example .env
docker compose up -d
```

The rebrand script rewrites 200 files or so with your name. Your project name is picked up from the
repository name automatically.

**It will refuse to run until you decide about the app icons.** A rebrand substitutes strings, and a
logo is not a string — so if nothing replaces the mark, every browser tab and every home-screen
install shows ScriptHammer's. That reached two live sites before this was a hard stop (#659, #898),
both times past a warning. Pass `--icon` with your own mark (`.svg`, `.png` or `.webp` — a symbol
rather than a wordmark, since these render at 32px), or `--no-icon` to say out loud that you are
shipping ours for now.

<details>
<summary><b>Rebrand options, and keeping your fork up to date</b></summary>

```bash
./scripts/rebrand.sh MyProject myuser "Description" --icon mark.svg --dry-run   # preview only
./scripts/rebrand.sh MyProject myuser "Description" --icon mark.svg --force     # no prompts
./scripts/rebrand.sh MyProject myuser "Description" --no-icon                   # keep our icons, deliberately
```

To pull upstream changes later:

```bash
git remote add upstream https://github.com/TortoiseWolfe/ScriptHammer.git
git fetch upstream
git merge upstream/main
```

**Want a string to survive the rebrand?** Put `rebrand:keep` in a comment on the same line. It is line-scoped, not file-scoped.

Full guide: [docs/FORKING.md](./docs/FORKING.md). Fresh-fork walkthrough: [docs/FORK-CHECKLIST.md](./docs/FORK-CHECKLIST.md).

</details>

## What it does

- 🔐 **Authentication.** Email and password, plus GitHub and Google sign-in. Protected routes and session management.
- 💳 **Payments.** Stripe one-off and PayPal subscriptions, with consent gating and webhook handling.
- 🔒 **Encrypted messaging.** Direct and group chat, end-to-end encrypted with ECDH key exchange, live over Supabase.
- 🛡️ **Admin surface.** Dashboard, moderation queue, security audit trail.
- 📱 **Installable app.** Works offline, syncs in the background.
- ♿ **Accessibility.** WCAG AA, colorblind assistance, font switching.
- 🔏 **Privacy.** Cookie consent gates analytics and tracking.
- 🎨 **35 themes.** 3 house themes plus 32 DaisyUI variants, and it remembers your pick.
- 🧩 **Component library.** Atomic design, documented in Storybook, scaffolded by a generator.
- 🧪 **Tested.** Vitest, Playwright across browsers, and Pa11y, all in CI.

Built with Next.js 15.5, React 19, TypeScript 5, Tailwind 4 and DaisyUI, on Docker and pnpm.

---

## Connecting the services

Everything above works with no accounts. These sections are for when you want the real features on.

<details>
<summary><b>🔐 Authentication (Supabase)</b></summary>

Nothing authenticates until you create a Supabase project and point the app at it.

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). The free tier is fine to start.
2. Run the database migrations. See [AUTH-SETUP.md Part 1](./docs/AUTH-SETUP.md#part-1-database-setup).
3. Turn on the providers you want:
   - [Email and password](./docs/AUTH-SETUP.md#part-2-enable-emailpassword-authentication), which messaging needs
   - [GitHub](./docs/AUTH-SETUP.md#part-3-enable-github-oauth-optional), via a [GitHub OAuth App](https://github.com/settings/developers)
   - [Google](./docs/AUTH-SETUP.md#part-4-enable-google-oauth-optional), via a [Google Cloud OAuth client](https://console.cloud.google.com/apis/credentials)
4. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your `.env`.
5. Check your work with the [Management API verification](./docs/AUTH-SETUP.md#verification-via-management-api). Placeholder client IDs once sat in that field for weeks before anyone noticed, which is what issue #85 was.

Full walkthrough: [docs/AUTH-SETUP.md](./docs/AUTH-SETUP.md).

</details>

<details>
<summary><b>💳 Payments (Stripe and PayPal)</b></summary>

Payments are built in but switched off. No API keys ship with the repo, so you bring your own before `/payment-demo` does anything real. Budget half an hour to an hour of account setup.

**Where keys go, and this part matters:**

| File           | Committed? | What belongs there                                                                    |
| -------------- | ---------- | ------------------------------------------------------------------------------------- |
| `.env.example` | Yes        | Placeholders only. Never real values.                                                 |
| `.env`         | No         | Public keys only, the `NEXT_PUBLIC_` ones. They ship in the browser bundle by design. |
| Supabase Vault | No         | Every server secret.                                                                  |

The site is a static export with no server runtime, so anything in `.env` without a `NEXT_PUBLIC_` prefix is unused. Edge Functions read the real secrets from the Vault.

1. **Stripe.** Sign up at [dashboard.stripe.com](https://dashboard.stripe.com). From Developers → API keys take the test-mode publishable key and secret key. Add a webhook pointing at your `stripe-webhook` Edge Function and copy its signing secret.
2. **PayPal.** Create a sandbox app at [developer.paypal.com](https://developer.paypal.com) under Apps & Credentials. Take the client ID and secret, add a sandbox webhook, copy the webhook ID.
3. **Split them.** Public keys go in `.env`. Server secrets go in the Supabase Vault, either with `supabase secrets set` or through Project Settings → Edge Functions → Secrets.
4. **Test.** Card `4242 4242 4242 4242` for Stripe, sandbox buyers for PayPal. No real money moves.

Full deployment guide: [docs/PAYMENT-DEPLOYMENT.md](./docs/PAYMENT-DEPLOYMENT.md). Current status: [PRP-STATUS.md](./docs/prp-docs/PRP-STATUS.md).

</details>

<details>
<summary><b>🔑 GitHub Actions secrets</b></summary>

Add these under **Settings → Secrets and variables → Actions**. That page has two tabs and
**the tab matters** — a value on the wrong one does not error, it arrives as an empty string.

**Secrets — the deploy hard-fails without this:**

| Secret                          | Purpose                                               |
| ------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_PAGESPEED_API_KEY` | `deploy.yml` exits 1 before building if this is empty |

**Variables, not secrets — `deploy.yml` reads these from `vars.*`:**

| Variable                        | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key                                         |
| `NEXT_PUBLIC_SITE_URL`          | Your origin. Unset, asset retention crawls _this_ site         |
| `NEXT_PUBLIC_DEPLOY_URL`        | Your origin. Unset, sitemap/robots advertise a `github.io` one |

Put the Supabase pair in Secrets and the deploy still goes green — with no backend in the bundle.

**Recommended, so the E2E suite can run:**

| Secret                                    | Purpose                          |
| ----------------------------------------- | -------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`               | Admin operations in tests        |
| `TEST_USER_PRIMARY_EMAIL` / `_PASSWORD`   | First test user                  |
| `TEST_USER_SECONDARY_EMAIL` / `_PASSWORD` | Second, for multi-user tests     |
| `TEST_USER_TERTIARY_EMAIL` / `_PASSWORD`  | Third, for group chat            |
| `TEST_EMAIL_DOMAIN`                       | Domain for generated test emails |

Supabase checks that an email domain has MX records, so `@example.com` is always rejected. Use Gmail plus-aliases like `you+test-a@gmail.com`.

**Optional, for author and site details:**

`NEXT_PUBLIC_AUTHOR_NAME`, `_EMAIL`, `_BIO`, `_ROLE`, `_AVATAR`, `_GITHUB`, `_LINKEDIN`, `_TWITTER`, `_TWITCH`, plus `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEPLOY_URL` and `NEXT_PUBLIC_SOCIAL_PLATFORMS`.

**Optional, for integrations:**

`NEXT_PUBLIC_CALENDAR_PROVIDER`, `NEXT_PUBLIC_CALENDAR_URL`, `NEXT_PUBLIC_DISQUS_SHORTNAME`, `NEXT_PUBLIC_PAGESPEED_API_KEY`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_SENTRY_DSN`.

Error monitoring stays off until `NEXT_PUBLIC_SENTRY_DSN` is set, and even then it only sends anything after the visitor accepts analytics. Emails, tokens and message bodies are stripped before anything leaves the browser. Session replay and tracing are off.

**Optional, for running migrations:**

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`.

</details>

<details>
<summary><b>🤖 GitHub token for Claude Code and SpecKit</b></summary>

The token is for reading and filing issues. It can't push. Pushes use your SSH key, so you stay in control of what lands.

1. Open [fine-grained token settings](https://github.com/settings/personal-access-tokens/new).
2. Name it, set 90 days, and scope it to this repository only.
3. Grant read-only on Contents, Pull requests and Actions. Issues needs read and write, for `/speckit.taskstoissues`.
4. Copy the token when it appears. You only see it once.

```bash
gh auth login          # GitHub.com, then SSH, then paste the token
ssh -T git@github.com  # should greet you by username
```

</details>

<details>
<summary><b>⚙️ Automatic configuration</b></summary>

At build time the project reads your git remote and works out the project name, the owner, the base path for GitHub Pages, and the app manifest.

If that goes wrong, check you have a remote with `git remote -v`, override the values in `.env`, and look at `src/config/project-detected.ts` after a build to see what it decided.

</details>

---

## Documentation

|                     |                                                              |
| ------------------- | ------------------------------------------------------------ |
| Developer guide     | [CLAUDE.md](./CLAUDE.md)                                     |
| Contributing        | [CONTRIBUTING.md](./CONTRIBUTING.md)                         |
| Creating components | [docs/CREATING_COMPONENTS.md](./docs/CREATING_COMPONENTS.md) |
| Testing             | [docs/project/TESTING.md](./docs/project/TESTING.md)         |
| Security            | [.github/SECURITY.md](./.github/SECURITY.md)                 |
| Forking             | [docs/FORKING.md](./docs/FORKING.md)                         |
| Architecture        | [docs/architecture/README.md](./docs/architecture/README.md) |
| Changelog           | [docs/project/CHANGELOG.md](./docs/project/CHANGELOG.md)     |

## Contributing

Fork it, branch, run the tests in Docker, open a pull request.

```bash
git checkout -b feature/your-thing
docker compose exec scripthammer pnpm test
```

Two checks have to pass before anything merges: `Test (20.x)` and `accessibility`. Nobody has to approve your PR, so ask for a review if the change warrants one rather than waiting for one. The details are in [CONTRIBUTING.md](./CONTRIBUTING.md).

---

<details>
<summary><b>📊 Project status and scores</b></summary>

Version 0.3.5. Lighthouse: performance 92, accessibility 98, best practices 95, SEO 100, PWA 92.

Component hierarchy is 22 atomic, 17 molecular, 8 organisms.

Progress by area is tracked in [PRP-STATUS.md](./docs/prp-docs/PRP-STATUS.md), and the design system work is in [the redesign plan](./docs/plans/2026-02-13-design-system-redesign.md) with its [implementation plan](./docs/plans/2026-02-13-design-system-implementation.md). Phases 0 through 4 are done, molecular and organism rebuilds are next.

</details>

<details>
<summary><b>🧾 Backlog and technical debt (maintainers)</b></summary>

The live list is [docs/TECHNICAL-DEBT.md](./docs/TECHNICAL-DEBT.md), and open work is tracked in [GitHub issues](https://github.com/TortoiseWolfe/ScriptHammer/issues).

The SPEC-041 through SPEC-064 queue that used to sit in this file has moved to those two places. Most of the E2E stabilisation items in it were finished in 2025-12 and the entries had gone stale where they sat.

Still outstanding from that queue, as SpecKit prompts:

```
/speckit.workflow SPEC-049: Group Service Implementation - Complete 8 unimplemented methods in src/services/messaging/group-service.ts: addMembers, getMembers, removeMember, leaveGroup, transferOwnership, upgradeToGroup, renameGroup, deleteGroup. These throw "Not implemented". Effort: 2-3 days.
```

```
/speckit.workflow SPEC-058: Payment Security RLS - Implement payment table RLS policies in Supabase: payments table user isolation, subscriptions table RLS, admin access policies. Unblocks 25 E2E tests. Effort: 1-2 days.
```

</details>

<details>
<summary><b>🧰 E2E fix loop priming prompt (maintainers)</b></summary>

If the E2E suite is broken and you want `/loop` to keep iterating on it, paste the priming prompt from [docs/e2e-loop-priming.md](./docs/e2e-loop-priming.md) into the loop command. It lists the current open issues, not a baseline, with concrete symptoms and what has already been tried.

Read its "Current Open Issues" section for where things actually stand. Do not treat the doc as a clean baseline.

</details>

## License

MIT. See [LICENSE](./LICENSE).
