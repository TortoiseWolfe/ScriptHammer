# ScriptHammer - Modern Next.js Starter with PWA

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/TortoiseWolfe/ScriptHammer)
[![Fork](https://img.shields.io/github/forks/TortoiseWolfe/ScriptHammer?style=social)](https://github.com/TortoiseWolfe/ScriptHammer/fork)
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
- 🧪 **Testing Suite** - 680+ unit tests, 40+ E2E tests, 58% coverage
- 📊 **Real-time Monitoring** - Web Vitals, Lighthouse scores, health checks
- 🚀 **CI/CD Pipeline** - GitHub Actions with automated deployment

## 🛠️ Tech Stack

- **Next.js 15.5** / **React 19** / **TypeScript 5**
- **Tailwind CSS 4** + **DaisyUI** (beta)
- **Vitest** / **Playwright** / **Pa11y**
- **Docker** / **GitHub Actions** / **pnpm 10.16.1**

## 🚀 Quick Start

### Docker Development (MANDATORY)

This project **REQUIRES Docker** for development to ensure consistency across all environments.

```bash
# 1. Fork on GitHub (your project name is auto-detected!)
# 2. Clone YOUR fork
git clone https://github.com/YOUR_USERNAME/YOUR_PROJECT_NAME.git
cd YOUR_PROJECT_NAME

# 3. Create .env file with your user ID
echo "UID=$(id -u)" > .env
echo "GID=$(id -g)" >> .env

# 4. Start Docker development environment
docker compose up     # Start everything in containers

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

## 📚 Documentation

- **Developer Guide**: See [CLAUDE.md](./CLAUDE.md) for comprehensive development documentation
- **Component Creation**: [docs/CREATING_COMPONENTS.md](./docs/CREATING_COMPONENTS.md)
- **PRP Workflow**: [docs/PRP-EXECUTION-GUIDE.md](./docs/PRP-EXECUTION-GUIDE.md)
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

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Run tests in Docker (`docker compose exec scripthammer pnpm test`)
4. Commit changes (`git commit -m 'Add feature'`)
5. Push and open a PR

## 📄 License

MIT - See [LICENSE](./LICENSE) for details

---

**For Forkers**: Your project name is automatically detected from your GitHub fork! No manual configuration needed. See [docs/FORKING-GUIDE.md](./docs/FORKING-GUIDE.md) for details.
