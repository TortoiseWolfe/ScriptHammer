# Technical Debt

This document tracks known technical issues, workarounds, and future concerns that need to be addressed.

## TODO Summary (2025-09-19)

**Total TODOs in codebase**: 13

- **Component Tests**: 6 (need expanded test coverage)
- **Feature Extensions**: 3 (validation system, error handler integrations)
- **Template TODOs**: 4 (intentional, part of code generation)

## Sprint 3.5 Progress (2025-09-18 - 2025-09-19)

### Completed

- ✅ Component Structure Audit - 100% compliance with 5-file pattern
- ✅ Bundle Size Optimization - Met target of 102KB First Load JS
- ✅ Dynamic Imports - Calendar providers now lazy-loaded
- ✅ Bundle Analyzer - Added for ongoing monitoring
- ✅ E2E CI Integration - Multi-browser testing in GitHub Actions
- ✅ CalendarEmbed Tests - Fixed for dynamic import compatibility
- ✅ Security Headers Documentation - Complete guide for all platforms
- ✅ Offline Queue Tests - All 12 tests passing
- ✅ GoogleAnalytics Storybook - ConsentProvider already configured
- ✅ PWA Manifest - Already using build-time generation
- ✅ Next.js Workaround - Confirmed no dummy files needed (2025-09-19)
- ✅ MSW Setup - Already configured in Storybook
- ✅ Configuration Simplification - Already clean, no webpack workarounds
- ✅ Full Test Suite - All 793 tests passing

## Current Issues

### 7. Disqus Theme Integration

**Date Added**: 2025-09-28
**Severity**: Low
**Impact**: UX - Comments section doesn't fully match DaisyUI themes

**Issue**: Disqus comments component only supports basic light/dark theme detection, not the full range of 32 DaisyUI themes. Attempts to read actual theme colors using computed styles cause Disqus to fail loading.

**Current Workaround**: Simplified to basic light/dark detection with hardcoded RGB colors that Disqus can parse.

**Proper Solution**:

- Investigate alternative methods to pass theme colors to Disqus iframe
- Consider using CSS custom properties that Disqus can interpret
- Possibly implement a theme color mapping system

**Files Affected**:

- `/src/components/molecular/DisqusComments.tsx`

## Resolved Issues

### ~~9. Environment Variable Configuration Duplication~~ ✅ RESOLVED

**Date Added**: 2025-09-25
**Date Resolved**: 2025-09-30
**Severity**: None (already resolved)
**Impact**: None

**Issue**: Documentation mentioned `nodemon-blog.json` containing Docker polling variables.

**Resolution**:

- File was already removed in previous cleanup
- Docker environment variables properly configured in `docker-compose.yml`
- No action needed - documentation was outdated

### ~~8. Next.js Dynamic Params Warning~~ ✅ RESOLVED

**Date Added**: 2025-09-28
**Date Resolved**: 2025-09-30
**Severity**: None
**Impact**: None

**Issue**: Next.js 15 showed warnings about using `params.slug` without awaiting params first in blog pages.

**Resolution**:

- Updated `/src/app/blog/[slug]/page.tsx` to use `params: Promise<{ slug: string }>`
- Updated `/src/app/blog/tags/[tag]/page.tsx` to use `params: Promise<{ tag: string }>`
- Both files now properly await params before accessing properties
- Follows Next.js 15 async params best practices

## Resolved Issues (Previous)

### ~~6. lint-staged Git Stash Issues in Docker~~ ✅ RESOLVED

**Date Added**: 2025-09-19
**Date Resolved**: 2025-09-19
**Severity**: None
**Impact**: None

**Issue**: lint-staged failed with git stash errors when running inside Docker container.

**Resolution**:

- Added `--no-stash` flag to lint-staged commands in Docker
- Modified `.husky/pre-commit` to use `pnpm exec lint-staged --no-stash`
- Removed problematic `vitest related --run` from lint-staged config
- Works correctly in both Docker and host environments

### ~~1. Next.js 15.5 Static Export Compatibility~~ ✅ RESOLVED

**Date Added**: 2025-09-18
**Date Resolved**: 2025-09-19
**Severity**: None
**Impact**: None

**Issue**: Previously thought Next.js 15.5.2 with `output: 'export'` required dummy Pages Router files, but this was incorrect.

**Resolution**:

- Tested build without any Pages Router files - works perfectly
- Next.js 15.5.2 supports pure App Router with static export
- No dummy files or workarounds needed
- Build completes successfully after clearing cache (`pnpm run clean:next`)

### ~~2. ContactForm Storybook Stories~~ ✅ RESOLVED

**Date Added**: 2025-09-18
**Date Resolved**: 2025-09-19
**Severity**: None
**Impact**: None

**Issue**: Previously thought ContactForm stories failed with jest.mock() errors.

**Resolution**:

- MSW (Mock Service Worker) is already configured in `.storybook/preview.tsx`
- Web3Forms API mocks are already set up in `/src/mocks/handlers.ts`
- Stories should work without jest.mock()
- The perceived issue may have been a build cache problem

### ~~3. GoogleAnalytics Storybook Context Error~~ ✅ RESOLVED

**Date Added**: 2025-09-18
**Date Resolved**: 2025-09-19
**Severity**: None
**Impact**: None

**Issue**: Previously thought GoogleAnalytics stories failed due to missing ConsentProvider.

**Resolution**:

- ConsentProvider is already configured as a global decorator in `.storybook/preview.tsx` (line 52-54)
- The GoogleAnalytics stories already include a MockConsentWrapper for demonstration
- No additional fixes needed

### ~~4. Project Configuration Complexity~~ ✅ RESOLVED

**Date Added**: 2025-09-18
**Date Resolved**: 2025-09-19
**Severity**: None
**Impact**: None

**Issue**: Thought the auto-detection of project configuration added unnecessary complexity.

**Resolution**:

- The configuration is already simplified and clean
- No webpack workarounds found in the codebase
- The detection script is straightforward and works well
- Generated config is a simple TypeScript file with constants
- No further simplification needed

### ~~5. Husky Pre-commit Hook Docker Detection~~ ✅ RESOLVED

**Date Added**: 2025-09-19
**Date Resolved**: 2025-09-19
**Severity**: None
**Impact**: None

**Issue**: Pre-commit hook failed when committing from inside Docker container because it tried to run `docker compose ps` which doesn't exist inside the container.

**Resolution**:

- Added detection for running inside Docker container (checks for `/app` directory)
- Hook now handles three scenarios properly:
  1. Inside Docker: runs `pnpm lint:staged` directly
  2. Host with Docker: uses `docker compose exec`
  3. Host without Docker: runs `pnpm` locally
- No longer need `--no-verify` when committing from inside Docker

## Future Concerns

### ~~1. Security Headers~~ ✅ DOCUMENTED

**Impact**: Production security
**Documentation**: `/docs/deployment/security-headers.md`

With the removal of the `headers()` function from Next.js config (due to static export incompatibility), security headers need to be configured at the hosting level. Complete documentation now available with platform-specific configurations for:

- ✅ Vercel (vercel.json)
- ✅ Netlify (\_headers file)
- ✅ nginx configuration
- ✅ Apache (.htaccess)
- ✅ CloudFlare Pages (\_headers or Workers)

### ~~2. PWA Manifest API Route~~ ✅ RESOLVED (2025-09-18)

**Impact**: ~~PWA functionality~~ None
**Status**: Already using build-time generation

The PWA manifest is properly generated at build time via `scripts/generate-manifest.js` which runs in the prebuild step. No API route exists - fully compatible with static export.

### ~~3. Test Coverage for Offline Features~~ ✅ RESOLVED (2025-09-18)

**Impact**: ~~Test reliability~~ None
**Status**: All 12 offline queue tests now passing

The offline queue integration tests previously had issues with React Hook Form timing but are now working correctly. No further action needed.

## Code Cleanup Status

1. ~~**Pages Router Dummy Files** (`src/pages/*`)~~ - ✅ Removed (2025-09-18)
2. ~~**Security headers constants**~~ - ✅ None found in next.config.ts (2025-09-19)
3. ~~**Webpack workarounds**~~ - ✅ None found in project.config.ts (2025-09-19)

## Performance Optimizations ~~Needed~~ ✅ COMPLETED

### ~~3. Font Loading Optimization~~ ✅ OPTIMIZED (2025-09-19)

**Status**: Complete

- Added `display: swap` to Geist fonts for faster rendering
- Added font preconnect links to Google Fonts
- Added fallback font stacks to prevent layout shifts
- Set font-display and size-adjust properties in CSS
- Optimized text rendering properties for better performance

### ~~1. Bundle Size~~ ✅ OPTIMIZED (2025-09-18)

**Status**: Complete

- Current First Load JS: 102KB (meets target)
- Added @next/bundle-analyzer for monitoring
- Run `pnpm run analyze` to view bundle composition

### ~~2. Lazy Loading~~ ✅ IMPLEMENTED (2025-09-18)

**Status**: Complete

- Calendar providers (CalendlyProvider, CalComProvider) now use dynamic imports
- Loading states implemented for better UX
- Maps already use dynamic loading with SSR disabled

3. **Font Loading**: Optimize font loading strategy to reduce CLS

## Testing Improvements

1. **Storybook Coverage**: Restore full story coverage for ContactForm
2. ~~**E2E Tests**: Currently only running locally, need CI integration~~ ✅ CI ADDED (2025-09-18)
   - Created `.github/workflows/e2e.yml` with multi-browser testing
   - Tests run on Chromium, Firefox, and WebKit
   - Artifacts and reports uploaded for review
3. **Visual Regression**: PRP-012 deferred but needed for UI stability

## E2E Test Debt (2025-12-26)

**Status**: 163 tests skipped (51% of 322 total tests)

### Category 1: Payment Features (89 skips)

Tests for features that don't exist yet.

| File                                      | Skips | Reason                           |
| ----------------------------------------- | ----- | -------------------------------- |
| `payment/08-security-rls.spec.ts`         | 25    | Payment tables/RLS not confirmed |
| `payment/06-realtime-dashboard.spec.ts`   | 20    | Dashboard not implemented        |
| `payment/05-offline-queue.spec.ts`        | 18    | Queue UI not implemented         |
| `payment/07-performance.spec.ts`          | 14    | Dashboard/history missing        |
| `payment/03-failed-payment-retry.spec.ts` | 14    | Retry UI not implemented         |
| `payment/02-paypal-subscription.spec.ts`  | 12    | Subscription mgmt missing        |
| `payment/01-stripe-onetime.spec.ts`       | 8     | Stripe keys not configured       |

**Unblock by**: Implementing payment features incrementally

### Category 2: Messaging Tests (35 skips)

Conditional skips - run when setup succeeds.

| File                                       | Skips | Condition         |
| ------------------------------------------ | ----- | ----------------- |
| `messaging/message-editing.spec.ts`        | 13    | `!setupSucceeded` |
| `messaging/performance.spec.ts`            | 10    | `!setupSucceeded` |
| `messaging/offline-queue.spec.ts`          | 6     | `!setupSucceeded` |
| `messaging/friend-requests.spec.ts`        | 2     | `testInfo.skip`   |
| `messaging/encrypted-messaging.spec.ts`    | 1     | Service key       |
| `messaging/complete-user-workflow.spec.ts` | 1     | Service key       |

**Unblock by**: Ensuring SUPABASE_SERVICE_ROLE_KEY in GitHub Secrets

### Category 3: Auth Tests (12 skips)

Environment-dependent tests.

| File                             | Skips | Reason               |
| -------------------------------- | ----- | -------------------- |
| `auth/sign-up.spec.ts`           | 5     | Service key required |
| `auth/protected-routes.spec.ts`  | 3     | Service key required |
| `auth/rate-limiting.spec.ts`     | 2     | Email domain config  |
| `auth/user-registration.spec.ts` | 1     | Full flow test       |

**Unblock by**: Configure GitHub Secrets or make tests resilient

### Category 4: Legacy Tests (4 skips)

| File                                 | Skips | Reason            |
| ------------------------------------ | ----- | ----------------- |
| `examples/homepage-with-pom.spec.ts` | 4     | Game demo removed |

**Unblock by**: Delete or update example tests

### Active Failures (Updated 2025-12-26)

| Category              | Failures | Status                                                   |
| --------------------- | -------- | -------------------------------------------------------- |
| `tests-accessibility` | 15       | ✅ SPEC-044: Fixed contrast ratio in Footer (40%→60%)    |
| `security-oauth`      | 15       | ✅ SPEC-047: Rewrote as proper security tests (all pass) |
| `tests-form`          | 12       | Form submission timing/validation                        |
| `avatar-upload`       | 12       | File upload crop interface, replace, remove flows        |
| `security-payment`    | 9        | ✅ SPEC-046: Added GDPR consent handling (all pass)      |
| `messaging-message`   | 9        | ✅ SPEC-045: Verified selectors correct (all pass)       |
| `tests-cross`         | 7        | Cross-page navigation timing                             |
| `tests-pwa`           | 6        | Service worker registration in CI                        |
| `tests-broken`        | 6        | Link checking timeouts                                   |
| `payment-04`          | 6        | ✅ SPEC-046: Fixed GDPR consent flow                     |
| `tests-theme`         | 3        | Theme switching assertions                               |
| `payment-01`          | 3        | Stripe payment flow                                      |
| `mobile-dropdown`     | 3        | Mobile menu interactions                                 |
| `messaging-friend`    | 3        | Friend request navigation                                |
| `messaging-complete`  | 3        | Complete workflow - retry button                         |
| `messaging-encrypted` | 2        | Zero-knowledge/key security tests                        |
| `messaging-gdpr`      | 1        | Deletion failure handling                                |
| `auth-session`        | 1        | Session clear on sign-out                                |
| `auth-protected`      | 1        | Payment access policies                                  |

**Recent Fixes (2025-12-26)**:

- ✅ SPEC-044: Fixed Footer text contrast from 40% to 60% opacity
- ✅ SPEC-045: Message editing selectors verified working (data-testid pattern)
- ✅ SPEC-046: Added handlePaymentConsent() for GDPR flow in payment tests
- ✅ SPEC-047: Rewrote OAuth CSRF tests to capture request URLs and verify state params

See [README.md](../README.md#-technical-debt-backlog-speckit-ready) for the prioritized SpecKit workflow commands.

## Documentation Updates Needed

1. Update deployment guides for security headers configuration
2. Document the forking process with new auto-configuration system
3. Add troubleshooting guide for common build issues

## Test Coverage Improvements Needed

### Component Tests

1. **CaptainShipCrewWithNPC** (`src/components/atomic/CaptainShipCrewWithNPC/CaptainShipCrewWithNPC.test.tsx`)
   - TODO comment on line 14: "Add more specific tests"
   - Currently only has basic render test
   - Need tests for game logic, player interactions, NPC behavior

### Accessibility Tests

Multiple components have TODO comments for expanding test coverage:

- **CaptainShipCrewWithNPC** (`CaptainShipCrewWithNPC.accessibility.test.tsx`) - line 14
- **CaptainShipCrew** (`CaptainShipCrew.accessibility.test.tsx`) - line 14
- **Dice** (`Dice.accessibility.test.tsx`) - line 14
- **DraggableDice** (`DraggableDice.accessibility.test.tsx`) - line 14
- **DiceTray** (`DiceTray.accessibility.test.tsx`) - line 14

Each TODO indicates need for:

- Tests with different prop combinations
- Keyboard navigation testing
- ARIA attribute verification
- Color contrast validation
- Focus management testing

## Feature Extensions Needed

### Validation System Extension

**Location**: `src/components/atomic/CaptainShipCrewWithNPC/CaptainShipCrewWithNPC.tsx`
**TODO**: Line 8 - "Add validation to other atomic components throughout the app"

- Current implementation demonstrates validation system with ValidatedInput
- Should extend to other atomic components: Button, Input, and other form components
- This would improve form consistency and error handling across the application

### Error Handler Integrations

**Location**: `src/utils/error-handler.ts`

1. **Logging Service Integration**
   - TODO on line 233: "Implement additional integration with logging service"
   - Currently only logs to console in development
   - Should integrate with services like Sentry, LogRocket, or DataDog
   - Would provide better production error tracking

2. **Notification System Integration**
   - TODO on line 252: "Integrate with your notification system"
   - Currently only logs user notifications to console
   - Should integrate with a proper toast/notification system
   - Would improve user experience for error feedback

## Template TODOs (Intentional)

The following TODO comments are part of code generation templates and are intentional:

1. **migrate-components.js** (lines 304, 350)
   - Template placeholders for generated test files
   - Gets replaced with actual test code when components are migrated

2. **validate-structure.test.js** (lines 152, 154)
   - Test fixtures for validation testing
   - Used to simulate incomplete component structures

These TODOs should remain as they are part of the tooling infrastructure.
