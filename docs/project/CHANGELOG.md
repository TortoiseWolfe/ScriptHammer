# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.5] - 2025-09-19

### Added

- **Sprint 3.5: Technical Debt Elimination** - Complete overhaul of accumulated technical debt
  - Fixed Next.js 15.5 build issues (no dummy Pages Router files needed)
  - Resolved Husky pre-commit Docker detection
  - Fixed lint-staged git stash issues with --no-stash flag
  - Optimized font loading for CLS reduction (display:swap, preconnect)
  - Documented 13 remaining TODOs with categorization
  - 46 technical debt tasks completed in 2 days

- **PRP-014: Geolocation Map** (2025-09-18)
  - Leaflet.js integration with OpenStreetMap tiles
  - GDPR-compliant location consent modal
  - Dynamic map loading with SSR disabled
  - IP-based fallback for desktop browsers

- **PRP-013: Calendar Integration** (2025-09-17)
  - Calendly and Cal.com embedding support
  - GDPR-compliant consent for third-party services
  - Dynamic calendar provider selection
  - Accessible scheduling interface

### Changed

- Updated package.json version from 0.3.0 to 0.3.5
- Status dashboard now shows PRP methodology progress instead of S3T tasks
- Deployment history uses ISO date format (YYYY-MM-DD)
- Removed keyword filter from deployment history display

### Fixed

- Status page showing incorrect Sprint 3 progress (was 0/129, now 12/14 PRPs)
- Feature count corrected from 33 to 32
- Recent deployments section now properly populated
- All Storybook stories now 100% functional
- 793 tests passing with stable build

## [0.3.0] - 2025-09-16

### Added

- **PRP-009: Web3Forms Integration** - Professional contact form with server-side email delivery
  - Zod schema validation with transform pipelines
  - Honeypot spam protection
  - Accessible form with WCAG AA compliance
  - 98% test coverage with TDD approach
  - Contact page at `/contact`
  - useWeb3Forms custom hook for form submission
  - Retry logic with exponential backoff
  - Rate limiting protection

### Changed

- Updated component structure to mandatory 5-file pattern (added accessibility tests)
- Increased test count to 620 tests across 49 test suites
- Enhanced PRP documentation with deferred task tracking

### Deferred

- Offline form submission support (moved to PRP-011: PWA Background Sync)
- Enhanced security features (reCAPTCHA, advanced rate limiting) - optional future enhancement
- Advanced UX features (auto-save drafts, file attachments) - optional future enhancement

## [0.2.0] - 2025-09-15

### Added

- **PRP-007: Cookie Consent & GDPR Compliance**
  - Granular consent management system
  - Privacy controls dashboard
  - Cookie and privacy policy pages
  - ConsentContext for app-wide consent state

- **PRP-008: Google Analytics 4 Integration**
  - Privacy-first implementation with consent mode
  - Debug utilities for development
  - Custom event tracking
  - Web Vitals integration

### Changed

- Component structure enforced to 5-file pattern
- Test coverage increased to 58%

## [0.1.0] - 2025-09-14

### Added

- **PRP-002: Component Structure** - Enforced 5-file pattern via CI/CD
- **PRP-003: E2E Testing Framework** - Playwright with 40+ tests (local only)
- **PRP-004: WCAG AA Compliance** - Pa11y and axe-core integration
- **PRP-005: Colorblind Mode** - Daltonization correction for 8 types of color vision
- **PRP-006: Font Switcher** - 6 fonts including accessibility options

### Core Features

- Next.js 15.5.2 with App Router
- 32 DaisyUI themes (16 light + 16 dark)
- PWA support with offline capabilities
- Atomic design component library
- Captain Ship & Crew dice game
- Vitest testing framework
- Docker-first development
- GitHub Actions CI/CD

## Links

- [GitHub Repository](https://github.com/TortoiseWolfe/ScriptHammer)
- [Live Demo](https://www.scripthammer.com/)
- [Storybook](https://www.scripthammer.com/storybook/)
- [Status Dashboard](https://www.scripthammer.com/status)
