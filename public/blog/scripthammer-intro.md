---
title: Scripthammer - Opinionated Next.js PWA Template
author: TortoiseWolfe
date: 2025-09-26
slug: scripthammer-intro
tags:
  - scripthammer
  - next.js
  - pwa
  - typescript
  - docker
categories:
  - documentation
excerpt: Opinionated Next.js 15.5 template with PWA support, 32 DaisyUI themes, Docker-first development environment, and comprehensive testing suite.
featuredImage: /blog-images/scripthammer-intro/featured-og.svg
featuredImageAlt: Scripthammer - The Opinionated Next.js PWA Template with 32 themes and Docker development
ogImage: /blog-images/scripthammer-intro/featured-og.png
ogTitle: Scripthammer - Opinionated Next.js PWA Template
ogDescription: Build production-ready Next.js apps with 32 themes, Docker development, PWA support, and comprehensive testing. No configuration hell.
twitterCard: summary_large_image
---

# Scripthammer: Your Production-Ready Next.js Template

Scripthammer is an opinionated Next.js template that comes batteries-included with everything you need to build modern web applications. No more setup fatigue - just clone and start building.

## What's Actually In This Template

![Scripthammer Dashboard](/blog-images/scripthammer-intro/dashboard-overview.svg)
_The Scripthammer dashboard showing the theme switcher and component structure_

### Core Technologies

- **[Next.js](https://nextjs.org/) 15.5.2** with App Router and static export support
- **[React](https://react.dev/) 19.1.0** with [TypeScript](https://www.typescriptlang.org/) strict mode
- **[Tailwind CSS](https://tailwindcss.com/) (Cascading Style Sheets) v4** with [DaisyUI](https://daisyui.com/) providing 32 built-in themes
- **PWA Support** with offline capabilities via [Workbox](https://developer.chrome.com/docs/workbox/)
- **[Docker](https://www.docker.com/)-First Development** - everything runs in containers

### Real Features That Work

#### 🎨 32 Theme System

Not just light and dark mode - we ship with 32 complete themes from [DaisyUI](https://daisyui.com/):

- Classic: light, dark, cupcake, bumblebee
- Modern: synthwave, cyberpunk, valentine, halloween
- Professional: corporate, business, emerald, forest
- Experimental: acid, lemonade, coffee, winter

Theme switching is instant and persisted across sessions.

#### ♿ Accessibility Built-In

- Color vision assistance for 8 types of color blindness
- Font size scaling system
- Screen reader optimizations
- Keyboard navigation throughout
- WCAG (Web Content Accessibility Guidelines) 2.1 AA compliance ready

#### 🧪 Testing That Actually Runs

![Testing Suite Output](/blog-images/scripthammer-intro/testing-output.svg)
_Comprehensive test suite with unit, E2E (End-to-End), and accessibility testing_

```bash
docker compose exec scripthammer pnpm run test:suite
```

- [Vitest](https://vitest.dev/) for unit tests (58% coverage)
- [Playwright](https://playwright.dev/) for E2E (End-to-End) testing (40+ tests)
- [Pa11y](https://pa11y.org/) for accessibility testing
- Component structure validation
- Pre-push hooks with [Husky](https://typicode.github.io/husky/)

#### 📱 True PWA Support

- Service worker with offline mode
- Background sync for form submissions
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) for local data storage
- App manifest for installability
- Push notification ready

## Docker Development Environment

![Docker Architecture](/blog-images/scripthammer-intro/docker-architecture.svg)
_Docker-first development environment with isolated containers_

Everything runs in [Docker](https://www.docker.com/). No "works on my machine" problems:

```bash
# Start development
docker compose up

# Run any command
docker compose exec scripthammer pnpm run dev
docker compose exec scripthammer pnpm test
docker compose exec scripthammer pnpm run generate:component
```

## Component Generator

Stop copying component boilerplate. Use the generator:

```bash
docker compose exec scripthammer pnpm run generate:component MyComponent atomic
```

This creates the required 5-file structure:

- `MyComponent.tsx` - Main component
- `MyComponent.test.tsx` - Unit tests
- `MyComponent.stories.tsx` - [Storybook](https://storybook.js.org/) stories
- `MyComponent.accessibility.test.tsx` - A11y tests
- `index.tsx` - Barrel export

## Project Configuration

The project auto-detects configuration from your Git repository:

```typescript
// Auto-configured from git remote
const projectConfig = {
  name: 'Scripthammer',
  owner: 'YourGitHubUsername',
  basePath: '/',
  repository: 'https://github.com/YourUsername/Scripthammer',
};
```

No manual configuration needed - it just works.

## Current Features in Production

### Privacy & Consent

- GDPR (General Data Protection Regulation)-compliant cookie consent system
- Granular privacy controls
- [Google Analytics](https://analytics.google.com/) integration (with consent)

### Blog System

- Markdown-based blog with frontmatter
- SEO (Search Engine Optimization) analysis and scoring
- Table of contents generation
- Offline-first with IndexedDB storage
- Background sync for offline edits

### Maps & Location

- [Leaflet](https://leafletjs.com/) integration for interactive maps
- Geolocation with privacy consent
- [OpenStreetMap](https://www.openstreetmap.org/) tiles (no API (Application Programming Interface) key needed)

### Calendar Integration

- [Calendly](https://calendly.com/) and [Cal.com](https://cal.com/) embedded support
- Privacy-first with consent modal
- Event scheduling capabilities

## File Structure

```
src/
├── app/                # Next.js app router pages
├── components/
│   ├── subatomic/     # Smallest reusable pieces
│   ├── atomic/        # Basic components
│   ├── molecular/     # Composite components
│   └── organisms/     # Full sections
├── contexts/          # React contexts
├── services/          # Business logic
├── lib/              # Core libraries
├── utils/            # Utility functions
└── types/            # TypeScript definitions
```

## Testing Commands

```bash
# Quick validation
docker compose exec scripthammer pnpm run test:quick

# Full test suite
docker compose exec scripthammer pnpm run test:suite

# Specific tests
docker compose exec scripthammer pnpm run type-check
docker compose exec scripthammer pnpm run lint
docker compose exec scripthammer pnpm run test:coverage
```

## Why Scripthammer?

1. **It Actually Works** - Clone, docker compose up, and you're running
2. **No Configuration Hell** - Opinionated choices that make sense
3. **Production Ready** - Not a toy, this is what we use in production
4. **Fully Typed** - TypeScript everywhere with strict mode
5. **Tested** - Real tests that actually catch bugs

## Getting Started

```bash
# Clone the repo
git clone https://github.com/YourUsername/Scripthammer.git

# Start Docker
docker compose up

# Open http://localhost:3000
```

That's it. No npm install, no version conflicts, no setup guides.

## What's Next?

Check out the [CONSTITUTION.md](https://github.com/TortoiseWolfe/ScriptHammer/blob/main/.specify/memory/constitution.md) for the project principles and current sprint goals. Read [CLAUDE.md](https://github.com/TortoiseWolfe/ScriptHammer/blob/main/CLAUDE.md) for AI (Artificial Intelligence) pair programming guidelines and best practices when working with this codebase.

This is Scripthammer. Stop configuring, start shipping.
