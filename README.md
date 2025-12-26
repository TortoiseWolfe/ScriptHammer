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

Run these specs in order (001 → 022). Copy a command to start the full SpecKit workflow.

### Priority 1: Blockers

```
/speckit.workflow SPEC-001: GitHub Secrets Configuration - Configure SUPABASE_SERVICE_ROLE_KEY, TEST_USER_SECONDARY_EMAIL, TEST_USER_SECONDARY_PASSWORD, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in GitHub repository secrets. This unblocks 47+ E2E tests including all messaging and auth tests. Infrastructure task, 15 min.
```

```
/speckit.workflow SPEC-002: Legacy Test Cleanup - Delete obsolete tests/e2e/examples/homepage-with-pom.spec.ts (4 skipped tests) referencing removed game demo. Quick cleanup, 30 min.
```

### Priority 2: E2E Stabilization

```
/speckit.workflow SPEC-003: Accessibility Test Fixes - Fix 15 axe-core E2E test failures. Run axe analysis to identify actual WCAG violations vs false positives. Fix legitimate issues in components. Tests: tests/e2e/accessibility/*.spec.ts. Effort: 1 day.
```

```
/speckit.workflow SPEC-004: OAuth Security Test Fixes - Fix 15 OAuth flow E2E test failures in tests/e2e/security/oauth-csrf.spec.ts. Issues: CSRF protection assertions, OAuth button selectors, redirect wait conditions. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-005: Form Submission Test Fixes - Fix 12 form E2E test failures. Add explicit wait conditions, update form submission assertions, handle race conditions. Files: tests/e2e/forms/*.spec.ts. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-006: Avatar Upload Test Fixes - Fix 12 avatar upload E2E test failures. Issues: crop interface interactions, replace/remove flows, file upload handling in CI. Files: tests/e2e/avatar/*.spec.ts. Effort: 4-6 hours.
```

### Priority 3: Group Messaging Feature

```
/speckit.workflow SPEC-007: Group Service Implementation - Complete 8 unimplemented methods in src/services/messaging/group-service.ts: addMembers (T043), getMembers (T074), removeMember (T060), leaveGroup (T061), transferOwnership (T062), upgradeToGroup (T054), renameGroup (T093), deleteGroup (T092). These methods throw "Not implemented" errors. Effort: 2-3 days.
```

### Priority 4: Unit Test Coverage

```
/speckit.workflow SPEC-008: SEO Library Tests - Add unit tests for 4 untested SEO modules: src/lib/seo/readability.ts, keywords.ts, content.ts, technical.ts. Create src/lib/seo/__tests__/ directory. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-009: Blog Library Tests - Add unit tests for 3 untested blog modules: src/lib/blog/seo-analyzer.ts, toc-generator.ts, markdown-processor.ts. Create src/lib/blog/__tests__/ directory. Effort: 3-4 hours.
```

```
/speckit.workflow SPEC-010: Messaging Service Tests - Add unit tests for core messaging services: message-service.ts (1182 lines), key-service.ts, group-key-service.ts, and src/services/auth/audit-logger.ts. Effort: 1 day.
```

```
/speckit.workflow SPEC-011: Auth Component Test Expansion - Expand 6 auth component tests that have TODO comments: AuthGuard, SignUpForm, ResetPasswordForm, SignInForm, ProtectedRoute, ForgotPasswordForm. Effort: 4-6 hours.
```

### Priority 5: Payment Features

```
/speckit.workflow SPEC-012: Payment Dashboard - Implement real-time payment dashboard with payment history table, recent transactions widget, and Supabase real-time updates. Unblocks 20 E2E tests. Effort: 2-3 days.
```

```
/speckit.workflow SPEC-013: Payment Offline Queue UI - Implement offline queue UI for payments with queue status indicator, pending payment list, and retry mechanism UI. Unblocks 18 E2E tests. Effort: 1 day.
```

```
/speckit.workflow SPEC-014: Payment Retry UI - Implement failed payment retry functionality with error display, retry button, payment method update flow, and retry confirmation. Unblocks 14 E2E tests. Effort: 1 day.
```

```
/speckit.workflow SPEC-015: PayPal Subscription Management - Implement subscription management with active subscriptions list, cancel/pause functionality, and billing cycle display. Unblocks 12 E2E tests. Effort: 2 days.
```

```
/speckit.workflow SPEC-016: Payment Security RLS - Implement payment table RLS policies in Supabase: payments table with user isolation, subscriptions table RLS, admin access policies. Unblocks 25 E2E tests. Effort: 1-2 days.
```

### Priority 6: Code Quality

```
/speckit.workflow SPEC-017: Large Component Refactoring - Refactor 4 oversized components: CaptainShipCrew.tsx (560 lines, no memoization), GlobalNav.tsx (482 lines), AccountSettings.tsx (476 lines), MessageBubble.tsx (411 lines). Add React.memo/useMemo where appropriate. Effort: 2-3 days.
```

```
/speckit.workflow SPEC-018: Error Handler Integrations - Implement TODO integrations in src/utils/error-handler.ts: Add Sentry/LogRocket/DataDog logging (line 233), add toast notification system (line 252), remove console-only logging. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-019: ESLint Disable Cleanup - Review and document 11 eslint-disable comments across codebase. Add JSDoc explaining necessity, fix underlying issues where possible, remove unnecessary disables. Effort: 2-3 hours.
```

```
/speckit.workflow SPEC-020: Hardcoded UUID Fix - Fix hardcoded UUID '00000000-0000-0000-0000-000000000000' in src/lib/payments/offline-queue.ts:166. Replace with auth context user ID. Effort: 30 min.
```

### Priority 7: Minor Improvements

```
/speckit.workflow SPEC-021: Disqus Theme Enhancement - Improve Disqus theme integration in src/components/molecular/DisqusComments.tsx. Map DaisyUI themes to Disqus color schemes, investigate CSS custom properties. Low priority UX improvement. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-022: Game Component A11y Tests - Expand 5 game component accessibility tests: CaptainShipCrewWithNPC, CaptainShipCrew, Dice, DraggableDice, DiceTray. Add keyboard navigation, ARIA verification, focus management tests. Effort: 4-6 hours.
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

## 📄 License

MIT - See [LICENSE](./LICENSE) for details

---

**For Template Users**: Your project name is automatically detected from your new repository! No manual configuration needed. See [docs/TEMPLATE-GUIDE.md](./docs/TEMPLATE-GUIDE.md) for details.
