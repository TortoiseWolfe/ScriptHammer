# Contracts: Sprint 3.5 - Technical Debt Reduction

**Date**: 2025-09-18
**Sprint**: 3.5

## Overview

This technical debt reduction sprint does not introduce new API contracts or modify existing ones. All work involves internal fixes without changing external interfaces.

## Existing Contracts (Unchanged)

### External APIs

- **Web3Forms**: Contact form submission (unchanged)
- **EmailJS**: Backup email provider (unchanged)
- **OpenStreetMap**: Tile server for maps (unchanged)

### Browser APIs

- **Service Worker**: Offline support (unchanged)
- **Geolocation**: Location services (unchanged)
- **IndexedDB**: Offline queue storage (unchanged)

### Build-Time Contracts

- **Next.js**: Static export configuration (fixing bugs only)
- **TypeScript**: Type definitions (maintained)
- **ESLint**: Linting rules (adding component validation)

## Test Contracts

### Component Testing Contract

All components must provide:

```typescript
interface ComponentTestContract {
  'index.tsx': BarrelExport;
  'Component.tsx': MainComponent;
  'Component.test.tsx': UnitTests;
  'Component.stories.tsx': StorybookStories;
  'Component.accessibility.test.tsx': A11yTests;
}
```

### Build Output Contract

```typescript
interface BuildOutputContract {
  staticExport: true;
  outputDir: '.next';
  publicDir: 'public';
  manifest: 'public/manifest.json';
  noApiRoutes: true;
  noDynamicRoutes: true;
}
```

### Performance Contract

```typescript
interface PerformanceContract {
  lighthouse: {
    performance: number >= 90;
    accessibility: number >= 90;
    bestPractices: number >= 90;
    seo: number >= 90;
  };
  bundle: {
    firstLoadJS: number < 90; // KB
  };
}
```

## Configuration Contracts

### Security Headers Contract

Each hosting provider must support:

```typescript
interface SecurityHeadersContract {
  'X-Frame-Options': string;
  'X-Content-Type-Options': string;
  'Referrer-Policy': string;
  'Content-Security-Policy': string;
  'Permissions-Policy': string;
}
```

### CI/CD Contract

```yaml
# GitHub Actions contract
on: [push, pull_request]
jobs:
  test:
    - lint
    - typecheck
    - unit-tests
    - integration-tests
    - e2e-tests # NEW
    - build
```

## No Breaking Changes

This sprint maintains:

- All existing API contracts
- All component props interfaces
- All configuration schemas
- All build outputs
- All test interfaces

## Validation

To verify contracts are maintained:

```bash
# Type checking ensures interfaces unchanged
pnpm run typecheck

# Build ensures output contract maintained
pnpm run build

# Tests ensure behavior contracts maintained
pnpm test
```

## Documentation Contracts

New documentation must follow:

### Security Headers Documentation

```markdown
## [Provider Name]

### Configuration File

[file location]

### Required Headers

[header list]

### Example Configuration

[code block]

### Verification Steps

[how to verify]
```

## Success Criteria

All contracts maintained while:

- Removing technical debt
- Improving performance
- Fixing test failures
- Enhancing documentation
- Standardizing components
