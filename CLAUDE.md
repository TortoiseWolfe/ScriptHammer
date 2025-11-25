# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Core Development Principles

1. **Proper Solutions Over Quick Fixes** - Implement correctly the first time
2. **Root Cause Analysis** - Fix underlying issues, not symptoms
3. **Stability Over Speed** - This is a production template
4. **Clean Architecture** - Follow established patterns consistently
5. **No Technical Debt** - Never commit TODOs or workarounds

## Docker-First Development (MANDATORY)

**CRITICAL**: This project REQUIRES Docker. Local pnpm/npm commands are NOT supported.

### NEVER Use sudo - Use Docker Instead

When encountering permission errors, **NEVER use `sudo`**. Use Docker:

```bash
# ❌ WRONG - Don't do this
sudo chown -R $USER:$USER .next
sudo rm -rf node_modules

# ✅ CORRECT - Use Docker
docker compose exec scripthammer rm -rf .next
docker compose exec scripthammer rm -rf node_modules
docker compose down && docker compose up
```

**Why**: The container runs as your user (UID/GID from .env). Docker commands execute with correct permissions automatically.

**Permission errors? Always try:**

1. `docker compose down && docker compose up` (restarts container, cleans .next)
2. `docker compose exec scripthammer pnpm run docker:clean`

### Essential Commands

```bash
# Start development
docker compose up

# Development server
docker compose exec scripthammer pnpm run dev

# Run tests
docker compose exec scripthammer pnpm test
docker compose exec scripthammer pnpm run test:suite    # Full suite

# Storybook
docker compose exec scripthammer pnpm run storybook

# E2E tests
docker compose exec scripthammer pnpm exec playwright test

# Type checking & linting
docker compose exec scripthammer pnpm run type-check
docker compose exec scripthammer pnpm run lint

# Clean start if issues
docker compose exec scripthammer pnpm run docker:clean
```

### Supabase Keep-Alive

Supabase Cloud free tier auto-pauses after 7 days. If paused:

```bash
docker compose exec scripthammer pnpm run prime
```

## Component Structure (MANDATORY)

Components must follow the 5-file pattern or CI/CD will fail:

```
ComponentName/
├── index.tsx                             # Barrel export
├── ComponentName.tsx                     # Main component
├── ComponentName.test.tsx                # Unit tests (REQUIRED)
├── ComponentName.stories.tsx             # Storybook (REQUIRED)
└── ComponentName.accessibility.test.tsx  # A11y tests (REQUIRED)
```

**Always use the generator:**

```bash
docker compose exec scripthammer pnpm run generate:component
```

See `docs/CREATING_COMPONENTS.md` for details.

## Architecture Overview

- **Next.js 15** with App Router, static export
- **React 19** with TypeScript strict mode
- **Tailwind CSS 4** + DaisyUI (32 themes)
- **Supabase** - Auth, Database, Storage, Realtime
- **PWA** with Service Worker (offline support)
- **Testing**: Vitest (unit), Playwright (E2E), Pa11y (a11y)

### Key Paths

```
src/
├── app/           # Next.js pages
├── components/    # Atomic design (subatomic/atomic/molecular/organisms/templates)
├── contexts/      # React contexts (AuthContext, etc.)
├── hooks/         # Custom hooks
├── lib/           # Core libraries
├── services/      # Business logic
└── types/         # TypeScript definitions
```

## PRP/SpecKit Workflow

For features taking >1 day:

1. Write PRP: `docs/prp-docs/<feature>-prp.md`
2. Create branch: `./scripts/prp-to-feature.sh <feature> <number>`
3. Run SpecKit: `/specify` → `/plan` → `/tasks` → `/implement`

See `docs/prp-docs/SPECKIT-PRP-GUIDE.md` for details.

## Common Issues & Solutions

### Permission Errors

**Always use Docker, never sudo:**

```bash
docker compose down && docker compose up
```

### Slow Supabase (10-30 seconds)

Instance paused after inactivity:

```bash
docker compose exec scripthammer pnpm run prime
```

### Tailwind CSS Not Loading

1. Don't import Leaflet CSS in `globals.css`
2. Import Leaflet CSS only in map components
3. Restart container after CSS changes

### Port 3000 In Use

```bash
docker compose down
lsof -i :3000
kill -9 <PID>
```

## Test Users

**Primary** (required):

- Email: `test@example.com`
- Password: `TestPassword123!`

**Secondary** (optional - for email verification tests):

- Configure in `.env`: `TEST_USER_SECONDARY_EMAIL`, `TEST_USER_SECONDARY_PASSWORD`

## Documentation

| Topic               | Location                               |
| ------------------- | -------------------------------------- |
| Authentication      | `docs/AUTH-SETUP.md`                   |
| Messaging System    | `docs/messaging/QUICKSTART.md`         |
| Payment Integration | `docs/features/payment-integration.md` |
| Security            | `docs/project/SECURITY.md`             |
| Mobile-First Design | `docs/MOBILE-FIRST.md`                 |
| Component Creation  | `docs/CREATING_COMPONENTS.md`          |
| Template Setup      | `docs/TEMPLATE-GUIDE.md`               |
| Testing Guide       | `docs/project/TESTING.md`              |

## Important Notes

- Never create components manually - use the generator
- All PRs must pass component structure validation
- E2E tests are local-only, not in CI pipeline
- Docker-first development is mandatory
- Use `min-h-11 min-w-11` for 44px touch targets (mobile-first)
