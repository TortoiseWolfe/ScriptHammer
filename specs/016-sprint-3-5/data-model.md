# Data Model: Sprint 3.5 - Technical Debt Reduction

**Date**: 2025-09-18
**Sprint**: 3.5

## Overview

This technical debt reduction sprint does not introduce new data models or entities. All work involves fixing existing code, tests, and configuration without changing data structures.

## Existing Models (No Changes)

The following existing models remain unchanged:

- User preferences (theme, consent)
- Contact form submissions
- Offline queue entries
- PWA manifest configuration
- Calendar consent states
- Geolocation permissions

## Configuration Changes (Non-Data)

### Build Configuration

- **Next.js Config**: Remove headers() function (incompatible with static export)
- **TypeScript Config**: No changes needed
- **ESLint Config**: Add custom rule for component structure validation

### Test Configuration

- **Vitest Config**: Update timeout settings for async tests
- **Playwright Config**: Add CI-specific settings
- **Storybook Config**: Add global decorators for context providers

### Deployment Configuration

- **Environment Variables**: Maintain existing structure
- **Build Scripts**: Add manifest generation step
- **CI/CD Pipeline**: Add E2E test job

## File Structure Changes

### Files to Remove

```
/src/pages/_app.tsx          # Dummy file for Next.js workaround
/src/pages/_document.tsx     # Dummy file for Next.js workaround
```

### Files to Add

```
/docs/deployment/security-headers.md     # Security headers documentation
/public/manifest.json                     # Generated PWA manifest
/.storybook/decorators/                  # Storybook context providers
/scripts/generate-manifest.js            # Build-time manifest generation
```

### Files to Modify

```
/src/tests/offline-integration.test.tsx  # Split into unit and E2E tests
/src/components/atomic/ContactForm/ContactForm.stories.tsx  # Use MSW
/src/components/privacy/GoogleAnalytics/GoogleAnalytics.stories.tsx  # Add decorator
```

## State Management (No Changes)

Existing state management remains unchanged:

- React Context for theme and consent
- React Hook Form for form state
- IndexedDB for offline queue
- Service Worker for PWA state

## API Contracts (No Changes)

No API changes required. Existing contracts remain:

- Web3Forms API for contact submissions
- EmailJS as backup provider
- Browser APIs for geolocation
- Service Worker APIs for offline support

## Validation Rules (Maintained)

All existing validation rules remain in effect:

- Form validation with Zod schemas
- Component prop validation with TypeScript
- Build-time validation with ESLint
- Runtime validation with error boundaries

## Migration Requirements

**None** - This sprint involves no data migrations or breaking changes. All fixes maintain backward compatibility.

## Testing Considerations

### Test Data Requirements

- No new test data needed
- Existing fixtures remain valid
- Mock data structures unchanged

### Test Isolation

- Unit tests: Use existing mocks
- Integration tests: Use existing test database
- E2E tests: Use existing test scenarios

## Performance Implications

### Positive Impact

- Reduced bundle size (target <90KB)
- Faster initial load (lazy loading)
- Better caching (static manifest)

### No Impact

- Database queries (no backend)
- API response times (static site)
- Data processing (no changes)

## Security Considerations

### Improvements

- Documented security headers for production
- No sensitive data in static files
- Maintained CSP policies

### No Changes

- Authentication (none required)
- Authorization (none required)
- Data encryption (not applicable)
