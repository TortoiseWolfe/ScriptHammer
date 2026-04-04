<!-- E2E FIX LOOP PRIMING PROMPT — paste into /loop 30m -->

```
Fix ScriptHammer E2E tests until ALL 6 chromium shards pass.
Chromium-only on push (weekly schedule runs all 3 browsers).

ARCHITECTURE:
- CI auth-setup job runs ONCE with AUTH_SETUP_JOB=true → nuclear cleanup + create keys/
  connections/conversations + save storageState artifact
- Each shard's Playwright setup project signs in fresh (own refresh token) but skips
  cleanup/creation (AUTH_SETUP_JOB absent) to avoid concurrent races
- signOut uses scope:'local' (Supabase defaults to scope:'global' which revokes ALL sessions)
- All messaging tests navigate via ?conversation=<id> URL, not sidebar click (sidebar query
  takes 3+ min on Supabase with concurrent shards)

CURRENT STATUS (2026-04-04, session 2):
- Shards 1, 4, 5, 6: PASS (shard 4 gdpr-consent is intermittent but passed latest)
- Shards 2, 3: FAIL but with DIFFERENT issues than original baseline
- Auth wipe root cause: FIXED via autoRefreshToken:false + E2E storage adapter
- Decryption failures: FIXED via shared secret cache invalidation on key change
- Remaining shard 2: session-expired race in handleReAuthModal (false positive detection)
- Remaining shard 3: offline-queue T148/T149 route intercept issues, real-time-delivery

METHODOLOGY (follow strictly, no guessing):

1. PULL LOGS:
   gh run list --limit 1 --workflow e2e.yml
   If in_progress → report and wait.
   If completed → gh run view <ID> 2>&1 | grep -E "(✓|X) E2E"
   If all 6 green → DONE, celebrate.

2. GET FAILURE DETAILS (for each failing shard):
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<JOB_ID>/logs 2>&1 | grep -oP "\d+ failed|\d+ passed" | tail -2
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<JOB_ID>/logs 2>&1 | grep -P "  \d+\) \[" | head -12

3. CHECK AUTH SETUP (did key seeding work?):
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<AUTH_SETUP_JOB_ID>/logs 2>&1 | grep -E "Cleaned up|Encryption keys created|Injected sh_keys|Setting up|Skipping nuclear"
   Auth-setup job (AUTH_SETUP_JOB=true) must show "Cleaned up" + "Encryption keys created".
   Per-shard runs must show "Skipping nuclear cleanup" + "Sign-in successful".

4. CHECK BROWSER CONSOLE (message send failures):
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<JOB_ID>/logs 2>&1 | grep "ConversationView\|sendMessage\|BROWSER CONSOLE DUMP"
   "message sent, appending optimistic" = success
   "sendMessage failed: You must be signed in" = session expired/refresh token race
   "message queued (offline/retry)" = send failed, queued for retry
   "AUTH FAILED. localStorage auth keys: []" = session wiped by auto-refresh

5. KNOWN ROOT CAUSES (confirmed by diagnostic data):
   a. Concurrent nuclear cleanup: auth.setup.ts ran in EVERY shard, 6 concurrent DELETEs
      racing. Fixed with AUTH_SETUP_JOB env var — only the CI job does cleanup.
   b. Shared refresh token: Supabase refresh tokens are single-use. All shards sharing one
      storageState meant first refresh wins, others get "invalid refresh token". Fixed by
      per-shard sign-in (own token) with no cleanup (dependencies:['setup']).
   c. signOut scope:'global': Supabase JS defaults to revoking ALL sessions server-side.
      Fixed with scope:'local' in AuthContext.tsx.
   d. EncryptionKeyGate deadlock: when user=null after auth loads, gate returned early
      without setCheckingKeys(false) → loading overlay stuck forever. Fixed.
   e. Direct URL navigation: sidebar conversation list query takes 3+ min under load.
      All tests use ?conversation=<id> URL param instead.
   f. ECDH key mismatch: SignInForm.initializeKeys() races with session persistence.
      resetEncryptionKeys() after performSignIn() for non-primary users.
   g. Service workers: intercept page.goto/reload → ERR_ABORTED. serviceWorkers:'block'.
   h. Auto-refresh session wipe: Supabase JS auto-refresh consumes single-use refresh
      tokens across test contexts. 403/406 from free tier contention triggers refresh →
      consumed token → SIGNED_OUT → localStorage wiped. Fixed with autoRefreshToken:false
      + E2E storage adapter blocking removeItem for auth tokens. setAllowAuthTokenRemoval()
      flag allows intentional sign-out to still work.
   i. Decryption / stale shared secrets: sharedSecretCache held ECDH secrets from wrong
      key pair (SignInForm salt S2 vs auth.setup salt S1). Thread showed "Encrypted with
      previous keys". Fixed by invalidating cache when sender CryptoKey reference changes.
   j. T148 route intercept: offline-queue T148 route handler intercepted GET requests from
      loadMessages(), breaking conversation UI. Fixed with POST-only route filter.

6. APPROACHES TRIED AND RESULTS (sessions 1-2, 2026-04-04):
   ✓ autoRefreshToken: false — FIXED shard 3 auth wipe (13→5). Initially BROKE shards 1,4
     but fixed by combining with E2E storage adapter.
   ✓ E2E storage adapter — blocks removeItem for auth-token keys. Combined with
     autoRefreshToken:false, fully fixes auth wipe without regressions.
   ✓ Conversation data cache + shared secret cache invalidation — fixes offline encryption
     and decryption when keys change between sessions.
   ✗ expires_at bump to 24h — NO EFFECT. Supabase JS decodes JWT exp claim directly.
   ✗ Post-navigation auth check (isVisible for "You must be logged in") — didn't trigger,
     auth error text behind MessagingGate overlay with pointer-events-none.
   ✗ handleReAuthModal session validity check — checks before Supabase client finishes
     processing 403 errors, so session appears valid at check time.
   ✗ Realtime subscription on ConversationView — TRIPLED 406 error count (153→425).
     Correctly reverted.

6. FIX (only after diagnosis):
   - Docker must be running: docker compose exec scripthammer echo alive
   - Type check: docker compose exec scripthammer npx tsc --noEmit
   - Unit test: docker compose exec scripthammer pnpm test
   - Commit via Docker with descriptive message explaining the ROOT CAUSE
   - Push, verify new CI run starts

7. KEY FILES:
   - .github/workflows/e2e.yml — 6 chromium shards, AUTH_SETUP_JOB=true on auth step
   - tests/e2e/auth.setup.ts — shouldDoFullSetup guard, nuclear cleanup, key injection
   - tests/e2e/utils/test-user-factory.ts — handleReAuthModal, resetEncryptionKeys, performSignIn
   - src/contexts/AuthContext.tsx — signOut({ scope: 'local' })
   - src/components/auth/EncryptionKeyGate/EncryptionKeyGate.tsx — setCheckingKeys(false) on null user
   - src/components/organisms/ConversationView/ConversationView.tsx — diagnostic console.log on send
   - src/components/PWAInstall.tsx — optional chaining on registration?.scope
   - src/lib/supabase/client.ts — Supabase singleton, autoRefreshToken, E2E storage adapter
   - src/services/messaging/message-service.ts — sendMessage, restoreKeysFromCache,
     conversationCache, sharedSecretCache with key invalidation
   - tests/e2e/messaging/message-editing.spec.ts — console forwarding, navigateToConversation
   - tests/e2e/messaging/offline-queue.spec.ts — T148 POST-only route, console forwarding
   - tests/e2e/messaging/complete-user-workflow.spec.ts — multi-retry with diagnostics
   - tests/e2e/messaging/encrypted-messaging.spec.ts — multi-retry with diagnostics
   - tests/unit/auth/use-auth.test.tsx — mock for setAllowAuthTokenRemoval
   - playwright.config.ts — chromium-only on push, dependencies:['setup'], serviceWorkers:'block'

RULES:
- NEVER skip or ignore tests — skipping is not passing
- NEVER guess — read logs and code first
- NEVER increase timeouts without fixing the underlying issue
- If the same fix doesn't work twice, the diagnosis is WRONG — stop and re-investigate
- Track: what failed, what the actual error was, what you changed, whether it helped
- Every multi-user test MUST call resetEncryptionKeys() after performSignIn() for User B
- Every browser.newContext() MUST use { storageState: { cookies: [], origins: [] } }
- ZERO REGRESSIONS — if a fix breaks previously-passing shards, revert immediately
- Do NOT add realtime subscriptions — they triple 406 errors and accelerate session wipe
- Compare shard × run pass/fail counts across runs. Any new failures = regression = revert
```

# ScriptHammer - Modern Next.js Template with PWA

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/TortoiseWolfe/ScriptHammer)
[![Use Template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge)](https://github.com/TortoiseWolfe/ScriptHammer/generate)
[![Stars](https://img.shields.io/github/stars/TortoiseWolfe/ScriptHammer?style=social)](https://github.com/TortoiseWolfe/ScriptHammer)

A comprehensive Next.js starter kit featuring 32 themes, PWA capabilities, component gallery, and extensive testing infrastructure.

## 🚀 Live Demos

- **Main App**: [https://www.scripthammer.com/](https://www.scripthammer.com/)
- **Storybook**: [https://www.scripthammer.com/storybook/](https://www.scripthammer.com/storybook/)
- **Status Dashboard**: [https://www.scripthammer.com/status](https://www.scripthammer.com/status)

## ✨ Key Features

- 🎨 **32 DaisyUI Themes** - Light/dark variants with persistent selection
- 📱 **Progressive Web App** - Installable with offline support
- 🧩 **Component Library** - Atomic design with Storybook documentation
- ♿ **Accessibility** - WCAG AA compliant, colorblind assistance
- 🔒 **Privacy Compliance** - GDPR-ready cookie consent system
- 🧪 **Testing Suite** - Comprehensive unit tests with 58% coverage, E2E test suite, accessibility testing
- 📊 **Real-time Monitoring** - Web Vitals, Lighthouse scores, health checks
- 🚀 **CI/CD Pipeline** - GitHub Actions with automated deployment

## 🛠️ Tech Stack

- **Next.js 15.5** / **React 19** / **TypeScript 5**
- **Tailwind CSS 4** + **DaisyUI** (beta)
- **Vitest** / **Playwright** / **Pa11y**
- **Docker** / **GitHub Actions** / **pnpm 10.16.1**

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git configured

### Docker Development (MANDATORY)

This project **REQUIRES Docker** for development to ensure consistency across all environments.

```bash
# 1. Use this template on GitHub (your project name is auto-detected!)
# 2. Clone YOUR new repository
git clone https://github.com/YOUR_USERNAME/YOUR_PROJECT_NAME.git
cd YOUR_PROJECT_NAME

# 3. Create and configure .env file (REQUIRED)
cp .env.example .env

# Edit .env to add your services (all optional except UID/GID):
# - Google Analytics ID
# - EmailJS/Web3Forms credentials
# - Calendar integration URLs
# - Author information
# See .env.example for all available options

# 4. Start Docker development environment
docker compose up     # Start everything (first build takes 5-10 minutes)

# Development is now running at http://localhost:3000
```

### Common Docker Commands

```bash
# Run commands inside container
docker compose exec scripthammer pnpm run dev         # Dev server
docker compose exec scripthammer pnpm test            # Run tests
docker compose exec scripthammer pnpm run storybook   # Storybook

# Clean restart if needed
docker compose down
docker compose up --build
```

**NOTE**: Local pnpm/npm commands are NOT supported. All development MUST use Docker.

## 🔐 GitHub Actions Secrets

Add these secrets to your repository at **Settings → Secrets and variables → Actions → Repository secrets**.

### ⚠️ Required for CI/CD (Add These First)

These secrets are **required** for the build and deployment workflows to succeed:

| Secret                          | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL (e.g., `https://abc123.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key                             |

### 🧪 Recommended for E2E Testing

These secrets enable full E2E test coverage. Without them, E2E tests will be skipped or fail:

| Secret                         | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`    | Service role key for admin operations in tests                         |
| `TEST_USER_PRIMARY_EMAIL`      | Primary test user email (use Gmail plus alias: `you+test-a@gmail.com`) |
| `TEST_USER_PRIMARY_PASSWORD`   | Primary test user password                                             |
| `TEST_USER_SECONDARY_EMAIL`    | Secondary test user for multi-user tests                               |
| `TEST_USER_SECONDARY_PASSWORD` | Secondary test user password                                           |
| `TEST_USER_TERTIARY_EMAIL`     | Tertiary test user for group chat tests                                |
| `TEST_USER_TERTIARY_PASSWORD`  | Tertiary test user password                                            |
| `TEST_EMAIL_DOMAIN`            | Email domain for generated test emails (e.g., `you+e2e@gmail.com`)     |

**Note**: Supabase validates email domains have MX records. Use Gmail plus aliases (`user+tag@gmail.com`) instead of `@example.com` which is always blocked.

### 📝 Optional - Author & Site Configuration

These customize the site appearance but aren't required for builds:

| Secret                         | Description                       |
| ------------------------------ | --------------------------------- |
| `NEXT_PUBLIC_AUTHOR_NAME`      | Your display name                 |
| `NEXT_PUBLIC_AUTHOR_EMAIL`     | Contact email                     |
| `NEXT_PUBLIC_AUTHOR_BIO`       | Short biography                   |
| `NEXT_PUBLIC_AUTHOR_ROLE`      | Job title/role                    |
| `NEXT_PUBLIC_AUTHOR_AVATAR`    | Avatar image URL                  |
| `NEXT_PUBLIC_AUTHOR_GITHUB`    | GitHub username                   |
| `NEXT_PUBLIC_AUTHOR_LINKEDIN`  | LinkedIn profile URL              |
| `NEXT_PUBLIC_AUTHOR_TWITTER`   | Twitter/X handle                  |
| `NEXT_PUBLIC_AUTHOR_TWITCH`    | Twitch username                   |
| `NEXT_PUBLIC_SITE_URL`         | Production site URL               |
| `NEXT_PUBLIC_DEPLOY_URL`       | Custom deployment URL             |
| `NEXT_PUBLIC_SOCIAL_PLATFORMS` | Comma-separated list of platforms |

### 📝 Optional - Integrations

| Secret                          | Description                         |
| ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_CALENDAR_PROVIDER` | Calendar service (e.g., `calendly`) |
| `NEXT_PUBLIC_CALENDAR_URL`      | Calendar booking URL                |
| `NEXT_PUBLIC_DISQUS_SHORTNAME`  | Disqus comments integration         |
| `NEXT_PUBLIC_PAGESPEED_API_KEY` | Google PageSpeed API key            |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics measurement ID     |

### 📝 Optional - Supabase Admin (for migrations)

| Secret                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token for Management API |
| `SUPABASE_DB_PASSWORD`  | Database password                        |
| `SUPABASE_PROJECT_REF`  | Project reference ID                     |

## 🔑 GitHub Personal Access Token (For Claude Code & SpecKit)

Claude Code and SpecKit use a GitHub token for **API access only** (reading issues, creating issues).
Git pushes use **SSH authentication** - keeping you in control of what gets committed.

### Creating Your Token (Read-Only API Access)

1. Go to **[GitHub Token Settings](https://github.com/settings/personal-access-tokens/new)** (fine-grained tokens)

2. Configure the token:
   - **Token name**: `ScriptHammer` or `Claude Code`
   - **Expiration**: 90 days recommended
   - **Repository access**: Select "Only select repositories" → choose your repository

3. Grant these **read-only** permissions:

   | Permission    | Access        | Used For                         |
   | ------------- | ------------- | -------------------------------- |
   | Contents      | **Read-only** | Reading files, checking status   |
   | Issues        | Read & Write  | `/speckit.taskstoissues` command |
   | Pull requests | **Read-only** | Viewing PR status                |
   | Actions       | **Read-only** | Checking CI status               |

4. Click **Generate token** and copy it immediately (shown only once)

### Setup

**GitHub CLI**:

```bash
gh auth login
# Choose: GitHub.com → SSH → Paste token for API access
```

**Git pushes use SSH** (your existing SSH key):

```bash
# Verify SSH is configured
ssh -T git@github.com
# Should show: Hi USERNAME! You've successfully authenticated...
```

### Why SSH + Limited Token?

- **You control commits** - AI can't push without your SSH key
- **API access only** - Token reads issues, creates issues, checks CI
- **No accidental pushes** - All pushes require explicit user action

## 🍴 Forking This Template

The quickest way to create your own project from ScriptHammer:

### 5-Minute Setup

```bash
# 1. Fork and clone
gh repo fork TortoiseWolfe/ScriptHammer --clone
cd YourProjectName

# 2. Run the rebrand script (updates 200+ files automatically)
./scripts/rebrand.sh MyProject myusername "My awesome project description"

# 3. Create environment file
cp .env.example .env
# Edit .env with your UID/GID (run: id -u && id -g)

# 4. Start development
docker compose up -d

# 5. Verify everything works
docker compose exec myproject pnpm run build
docker compose exec myproject pnpm test

# 6. Commit and push
docker compose exec myproject git add -A
docker compose exec myproject git commit -m "Rebrand to MyProject"
git push
```

### Rebrand Script Options

```bash
# Preview changes without modifying files
./scripts/rebrand.sh MyProject myuser "Description" --dry-run

# Skip confirmation prompts
./scripts/rebrand.sh MyProject myuser "Description" --force

# Keep CNAME file (for custom domains)
./scripts/rebrand.sh MyProject myuser "Description" --keep-cname
```

For detailed setup instructions, see [docs/FORKING.md](./docs/FORKING.md).

### Keeping Your Fork Updated

```bash
# Add upstream and pull changes
git remote add upstream https://github.com/TortoiseWolfe/ScriptHammer.git
git fetch upstream
git merge upstream/main
```

See [docs/FORKING.md](./docs/FORKING.md) for detailed sync instructions and [docs/FORKING-FEEDBACK.md](./docs/FORKING-FEEDBACK.md) for manual fixes if merging fails.

## ⚙️ Auto-Configuration

The project automatically detects your repository name and owner from git remote URL at build time:

- **Project name**: Detected from repository name
- **Owner**: Detected from GitHub username
- **Base path**: Configured for GitHub Pages deployment
- **PWA manifest**: Generated with your project name

**Troubleshooting**:

- If auto-detection fails, ensure you have a git remote: `git remote -v`
- Override with environment variables in `.env` if needed
- Check `src/config/project-detected.ts` after build to see detected values

## 📚 Documentation

- **Developer Guide**: See [CLAUDE.md](./CLAUDE.md) for comprehensive development documentation
- **Component Creation**: [docs/CREATING_COMPONENTS.md](./docs/CREATING_COMPONENTS.md)
- **PRP/SpecKit Workflow**: [docs/prp-docs/SPECKIT-PRP-GUIDE.md](./docs/prp-docs/SPECKIT-PRP-GUIDE.md) - Quick reference for feature development
- **Testing Guide**: [docs/project/TESTING.md](./docs/project/TESTING.md)
- **Contributing**: [docs/project/CONTRIBUTING.md](./docs/project/CONTRIBUTING.md)
- **Security**: [docs/project/SECURITY.md](./docs/project/SECURITY.md)
- **Changelog**: [docs/project/CHANGELOG.md](./docs/project/CHANGELOG.md)

## 📋 Technical Debt Backlog (SpecKit Ready)

For detailed tracking of E2E test fixes, helper patterns, and resolved issues, see [`docs/TECHNICAL-DEBT.md`](./docs/TECHNICAL-DEBT.md).

Run these specs in order (041 → 064). Copy a command to start the full SpecKit workflow.

### Priority 1: Blockers

**SPEC-041: ✅ COMPLETE** - GitHub secrets verified configured (2025-12-26). E2E status: **298 passed, 19 failed, 12 flaky, 61 skipped** (as of 2025-12-27).

**SPEC-042: ❌ INVALID** - File is NOT obsolete. Analysis: `tests/e2e/examples/homepage-with-pom.spec.ts` has 5 working tests + 4 skipped (with documented reasons). It's in `examples/` as a POM pattern teaching example. The 4 skips document former homepage features - this is valuable history, not technical debt.

### Priority 2: E2E Stabilization (mostly resolved - see TECHNICAL-DEBT.md)

**SPEC-043: ✅ COMPLETE** - Form honeypot fix merged (2025-12-26). Added `isHoneypotField()` helper to skip bot trap fields.

**SPEC-044: ✅ COMPLETE** - Accessibility contrast fix merged (2025-12-26). Changed `text-base-content/40` to `/60` in Footer.

**SPEC-045: ✅ COMPLETE** - Already fixed in commit 2a8aa08 (2025-12-26). All 43 message-editing tests pass.

**SPEC-046: ✅ COMPLETE** - Payment isolation fix merged (2025-12-26). Added `handlePaymentConsent()` helper. All 24 tests pass.

**SPEC-047: ✅ COMPLETE** - OAuth CSRF tests rewritten as proper security tests (2025-12-26).

**SPEC-048: ✅ COMPLETE** - Theme/PWA tests fixed with flexible assertions (2025-12-26).

### Priority 3: Group Messaging Feature

```
/speckit.workflow SPEC-049: Group Service Implementation - Complete 8 unimplemented methods in src/services/messaging/group-service.ts: addMembers (T043), getMembers (T074), removeMember (T060), leaveGroup (T061), transferOwnership (T062), upgradeToGroup (T054), renameGroup (T093), deleteGroup (T092). These methods throw "Not implemented" errors. Effort: 2-3 days.
```

### Priority 4: Unit Test Coverage

```
/speckit.workflow SPEC-050: SEO Library Tests - Add unit tests for 4 untested SEO modules: src/lib/seo/readability.ts, keywords.ts, content.ts, technical.ts. Create src/lib/seo/__tests__/ directory. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-051: Blog Library Tests - Add unit tests for 3 untested blog modules: src/lib/blog/seo-analyzer.ts, toc-generator.ts, markdown-processor.ts. Create src/lib/blog/__tests__/ directory. Effort: 3-4 hours.
```

```
/speckit.workflow SPEC-052: Messaging Service Tests - Add unit tests for core messaging services: message-service.ts (1182 lines), key-service.ts, group-key-service.ts, and src/services/auth/audit-logger.ts. Effort: 1 day.
```

```
/speckit.workflow SPEC-053: Auth Component Test Expansion - Expand 6 auth component tests that have TODO comments: AuthGuard, SignUpForm, ResetPasswordForm, SignInForm, ProtectedRoute, ForgotPasswordForm. Effort: 4-6 hours.
```

### Priority 5: Payment Features

```
/speckit.workflow SPEC-054: Payment Dashboard - Implement real-time payment dashboard with payment history table, recent transactions widget, and Supabase real-time updates. Unblocks 20 E2E tests. Effort: 2-3 days.
```

```
/speckit.workflow SPEC-055: Payment Offline Queue UI - Implement offline queue UI for payments with queue status indicator, pending payment list, and retry mechanism UI. Unblocks 18 E2E tests. Effort: 1 day.
```

```
/speckit.workflow SPEC-056: Payment Retry UI - Implement failed payment retry functionality with error display, retry button, payment method update flow, and retry confirmation. Unblocks 14 E2E tests. Effort: 1 day.
```

```
/speckit.workflow SPEC-057: PayPal Subscription Management - Implement subscription management with active subscriptions list, cancel/pause functionality, and billing cycle display. Unblocks 12 E2E tests. Effort: 2 days.
```

```
/speckit.workflow SPEC-058: Payment Security RLS - Implement payment table RLS policies in Supabase: payments table with user isolation, subscriptions table RLS, admin access policies. Unblocks 25 E2E tests. Effort: 1-2 days.
```

### Priority 6: Code Quality

```
/speckit.workflow SPEC-059: Large Component Refactoring - Refactor 4 oversized components: CaptainShipCrew.tsx (560 lines, no memoization), GlobalNav.tsx (482 lines), AccountSettings.tsx (476 lines), MessageBubble.tsx (411 lines). Add React.memo/useMemo where appropriate. Effort: 2-3 days.
```

```
/speckit.workflow SPEC-060: Error Handler Integrations - Implement TODO integrations in src/utils/error-handler.ts: Add Sentry/LogRocket/DataDog logging (line 233), add toast notification system (line 252), remove console-only logging. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-061: ESLint Disable Cleanup - Review and document 11 eslint-disable comments across codebase. Add JSDoc explaining necessity, fix underlying issues where possible, remove unnecessary disables. Effort: 2-3 hours.
```

```
/speckit.workflow SPEC-062: Hardcoded UUID Fix - Fix hardcoded UUID '00000000-0000-0000-0000-000000000000' in src/lib/payments/offline-queue.ts:166. Replace with auth context user ID. Effort: 30 min.
```

### Priority 7: Minor Improvements

```
/speckit.workflow SPEC-063: Disqus Theme Enhancement - Improve Disqus theme integration in src/components/molecular/DisqusComments.tsx. Map DaisyUI themes to Disqus color schemes, investigate CSS custom properties. Low priority UX improvement. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-064: Game Component A11y Tests - Expand 5 game component accessibility tests: CaptainShipCrewWithNPC, CaptainShipCrew, Dice, DraggableDice, DiceTray. Add keyboard navigation, ARIA verification, focus management tests. Effort: 4-6 hours.
```

## 🎯 Project Status

**Version 0.3.5** - Sprint 3.5 Complete ✅ | 12 of 14 PRPs completed

| Category      | Completed                                         | Remaining         |
| ------------- | ------------------------------------------------- | ----------------- |
| Foundation    | Component Structure, E2E Testing                  | PRP Methodology   |
| Accessibility | WCAG AA, Colorblind Mode, Font Switcher           | -                 |
| Privacy       | Cookie Consent, Google Analytics                  | -                 |
| Forms         | Web3Forms Integration, EmailJS, PWA Sync          | -                 |
| Features      | Calendar Integration, Geolocation Map             | Visual Regression |
| Tech Debt     | Sprint 3.5: All 46 tasks complete (2025-09-19) ✨ | -                 |

See [docs/prp-docs/PRP-STATUS.md](./docs/prp-docs/PRP-STATUS.md) for detailed progress.

## 🏆 Lighthouse Scores

[![WCAG 2.1 AA Compliant](https://img.shields.io/badge/WCAG%202.1-AA%20Compliant-success)](https://www.w3.org/WAI/WCAG21/quickref/)

- **Performance**: 92/100
- **Accessibility**: 98/100
- **Best Practices**: 95/100
- **SEO**: 100/100
- **PWA**: 92/100

## 🤝 Contributing

1. Fork the repository (for contributing back to ScriptHammer)
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Run tests in Docker (`docker compose exec scripthammer pnpm test`)
4. Commit changes (`git commit -m 'Add feature'`)
5. Push and open a PR

## Design System Redesign

Custom ScriptHammer theme (dark default + light variant) built on the existing DaisyUI/Tailwind stack. Storybook upgrade to v10, hierarchy cleanup, then bottom-up component reskin. Includes theme template tooling for forks.

**Design doc**: [docs/plans/2026-02-13-design-system-redesign.md](./docs/plans/2026-02-13-design-system-redesign.md)
**Implementation plan**: [docs/plans/2026-02-13-design-system-implementation.md](./docs/plans/2026-02-13-design-system-implementation.md)

### Progress

| Phase | Description                                          | Status   |
| ----- | ---------------------------------------------------- | -------- |
| 0     | Hierarchy cleanup (8 component moves)                | Complete |
| 1     | Storybook 9.1.5 → 10.2.8                             | Complete |
| 2     | Custom DaisyUI themes (dark + light, WCAG AAA)       | Complete |
| 3     | Theme template system (CUSTOM-THEME.md + rebrand.sh) | Complete |
| 4     | Redesign atomic components                           | Complete |
| 5     | Rebuild molecular & organism components              | Next     |
| 6     | Page-by-page polish                                  | Pending  |

Current component hierarchy: 22 atomic, 17 molecular, 8 organisms.

### Session Continuation Prompt

```
Read these files to pick up the design system redesign:

1. CLAUDE.md - Project rules, Docker setup, component standards
2. docs/plans/2026-02-13-design-system-redesign.md - Approved design (Phase 4 section)
3. docs/plans/2026-02-13-design-system-implementation.md - Task-by-task plan
4. src/app/globals.css - Custom theme definitions (scripthammer-dark, scripthammer-light)

Use superpowers:executing-plans to work through the implementation plan.
Phases 0-6 complete. Next: final polish or new feature work.

Key context:
- Everything runs inside Docker: docker compose exec scripthammer <command>
- pnpm, not npm
- DaisyUI beta with Tailwind v4 CSS-first config (@plugin syntax)
- ScriptHammer is a template, design must be bold but also easy to rebrand
- Brand colors: silver/steel (primary), warm amber (secondary), electric accent, charcoal base
- Dark theme default, light variant available
- Both themes pass WCAG AAA (7:1) contrast
- Preserve all existing accessibility work
- Aesthetic: bold, industrial, developer-focused. VS Code dark meets metallic craftsmanship.
- Component hierarchy: 22 atomic, 17 molecular, 8 organisms
- Pattern: audit component in Storybook against both themes, update, verify a11y, commit
```

## 📄 License

MIT - See [LICENSE](./LICENSE) for details

---

**For Template Users**: Your project name is automatically detected from your new repository! No manual configuration needed. See [docs/TEMPLATE-GUIDE.md](./docs/TEMPLATE-GUIDE.md) for details.
