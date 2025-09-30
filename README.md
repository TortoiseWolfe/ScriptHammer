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
