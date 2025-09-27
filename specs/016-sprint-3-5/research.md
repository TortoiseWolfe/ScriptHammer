# Research Results: Sprint 3.5 - Technical Debt Reduction

**Date**: 2025-09-18
**Sprint**: 3.5
**Focus**: Technical Debt Elimination

## Executive Summary

This document consolidates research findings for resolving 11 technical debt items identified in the CRUDkit project. All decisions prioritize stability, maintainability, and backward compatibility.

## Critical Priority Research

### 1. Next.js 15.5 Static Export Bug

**Decision**: Monitor Next.js releases and remove dummy files when bug is fixed
**Rationale**: Next.js 15.5.2 has a known issue where static export tries to process Pages Router files even in App Router-only projects
**Alternatives considered**:

- Downgrade to Next.js 15.0.3 (rejected - would lose new features)
- Keep dummy files permanently (rejected - adds confusion)
- Switch to different framework (rejected - too disruptive)

**Implementation approach**:

1. Check Next.js changelog for fix in versions > 15.5.2
2. Test build without dummy files
3. Remove `/src/pages/_app.tsx` and `/src/pages/_document.tsx` when confirmed working

### 2. Security Headers Configuration

**Decision**: Create comprehensive documentation for hosting-level configuration
**Rationale**: Static export doesn't support `headers()` function in next.config.ts
**Alternatives considered**:

- Use middleware (rejected - not available in static export)
- Embed headers in HTML meta tags (rejected - insufficient for security)
- Switch to server-side rendering (rejected - changes deployment model)

**Documentation needed for**:

- Vercel: vercel.json configuration
- Netlify: \_headers file
- nginx: server block configuration
- CloudFlare: Page Rules or Workers

### 3. Offline Queue Test Failures

**Decision**: Split into focused unit tests and E2E tests
**Rationale**: React Hook Form async validation has timing issues in test environment
**Alternatives considered**:

- Increase test timeouts (rejected - masks real issues)
- Mock React Hook Form (rejected - reduces test value)
- Rewrite without React Hook Form (rejected - too disruptive)

**Test strategy**:

- Unit tests: Test queue operations independently
- Integration tests: Test form submission without timing dependencies
- E2E tests: Full browser validation with Playwright

## High Priority Research

### 4. ContactForm Storybook Stories

**Decision**: Use Mock Service Worker (MSW) instead of jest.mock()
**Rationale**: MSW works better with Storybook's module system
**Alternatives considered**:

- Storybook decorators with manual mocks (possible but more complex)
- Remove stories entirely (rejected - reduces documentation)

### 5. GoogleAnalytics Storybook Context

**Decision**: Add ConsentProvider as global decorator in .storybook/preview.tsx
**Rationale**: Ensures all stories have required context
**Alternatives considered**:

- Story-specific decorators (rejected - repetitive)
- Mock ConsentProvider (possible but less realistic)

### 6. PWA Manifest Generation

**Decision**: Generate manifest.json at build time using a script
**Rationale**: Static export doesn't support API routes
**Alternatives considered**:

- Static manifest file (rejected - loses dynamic configuration)
- Client-side generation (rejected - bad for PWA discovery)

### 7. Component Structure Standardization

**Decision**: Enforce 5-file pattern via ESLint custom rule
**Rationale**: Automated enforcement prevents drift
**Alternatives considered**:

- Manual code reviews (rejected - human error prone)
- Pre-commit hooks only (rejected - doesn't catch all cases)
- CI/CD validation only (rejected - catches issues too late)

## Medium Priority Research

### 8. Bundle Size Optimization

**Decision**: Implement code splitting and dynamic imports
**Rationale**: Reduces initial load without losing functionality
**Tools identified**:

- `pnpm analyze` for bundle analysis
- `@next/bundle-analyzer` for visualization
- Dynamic imports for heavy components

### 9. Heavy Component Lazy Loading

**Decision**: Use Next.js dynamic() with custom loading components
**Rationale**: Built-in solution with SSR support
**Components to lazy load**:

- Leaflet maps (~40KB)
- Calendar embeds (~25KB)
- Chart libraries (if added)

### 10. Project Configuration Simplification

**Decision**: Remove webpack workarounds and use environment variables
**Rationale**: Simpler build process, easier debugging
**Changes needed**:

- Move dynamic config to build-time environment variables
- Remove complex require() statements
- Simplify detection script

### 11. E2E Tests CI Integration

**Decision**: Add Playwright to GitHub Actions with caching
**Rationale**: Automated E2E testing catches integration issues
**Configuration needed**:

- Install Playwright browsers in CI
- Cache browser binaries
- Run on pull requests
- Generate test reports

## Implementation Priority

Based on research, recommended implementation order:

1. **Week 1**: Critical items (Next.js workarounds, security docs, test fixes)
2. **Week 1-2**: High priority items (Storybook fixes, PWA manifest, component structure)
3. **Week 2-3**: Medium priority items (bundle optimization, lazy loading, CI integration)

## Risk Assessment

**Low Risk**:

- Documentation updates
- Storybook configuration changes
- Adding lazy loading

**Medium Risk**:

- Test refactoring (may reveal hidden issues)
- Bundle optimization (may affect functionality)
- CI integration (may slow down pipeline)

**High Risk**:

- Next.js workaround removal (depends on upstream fix)
- Component structure enforcement (may require significant refactoring)

## Dependencies

No external dependencies on other teams or systems. All fixes are internal to the CRUDkit project.

## Success Metrics

- Build succeeds without dummy files
- All tests passing (including offline queue)
- Storybook stories 100% functional
- Bundle size < 90KB
- E2E tests running in CI
- Documentation complete for all deployment scenarios
