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
