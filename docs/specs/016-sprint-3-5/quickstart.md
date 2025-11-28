# Quickstart Guide: Sprint 3.5 - Technical Debt Validation

**Sprint**: 3.5
**Date**: 2025-09-18
**Purpose**: Validate all technical debt fixes are working correctly

## Prerequisites

```bash
# Ensure you're on the correct branch
git checkout 016-sprint-3-5

# Install dependencies
pnpm install

# Clean previous builds
pnpm run docker:clean
```

## Validation Steps

### 1. Verify Next.js Build Without Workarounds

```bash
# Check if Next.js bug is fixed (try without dummy files)
rm -f src/pages/_app.tsx src/pages/_document.tsx
pnpm run build

# If build fails, restore dummy files for now
git checkout src/pages/_app.tsx src/pages/_document.tsx
```

**Expected**: Build should complete without errors when Next.js bug is fixed

### 2. Validate All Tests Pass

```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Verify offline queue tests are passing
pnpm test src/tests/offline-integration.test.tsx
```

**Expected**: All tests passing, including previously failing offline queue tests

### 3. Verify Storybook Stories

```bash
# Start Storybook
pnpm run storybook

# Navigate to:
# - ContactForm stories (should render without errors)
# - GoogleAnalytics stories (should show with context)
```

**Expected**: All stories render correctly without initialization errors

### 4. Check PWA Manifest Generation

```bash
# Generate manifest at build time
pnpm run build

# Verify manifest exists
ls -la public/manifest.json

# Check manifest content
cat public/manifest.json
```

**Expected**: manifest.json generated with correct content

### 5. Validate Component Structure

```bash
# Run component structure validation
pnpm run lint

# Check a sample component follows 5-file pattern
ls -la src/components/atomic/ContactForm/
```

**Expected**:

- ESLint reports no component structure violations
- Each component has 5 required files

### 6. Verify Bundle Size Optimization

```bash
# Analyze bundle
pnpm run analyze

# Check build output
pnpm run build
```

**Expected**: First Load JS < 90KB (reduced from 102KB)

### 7. Test Lazy Loading

```bash
# Start development server
pnpm run dev

# Open browser DevTools Network tab
# Navigate to page with map component
# Verify map loads dynamically
```

**Expected**: Heavy components load on-demand with loading states

### 8. Validate E2E Tests in CI

```bash
# Run E2E tests locally
pnpm run test:e2e

# Push to GitHub and check Actions tab
git push origin 016-sprint-3-5
```

**Expected**: E2E tests run automatically in GitHub Actions

### 9. Review Documentation

```bash
# Check security headers documentation
cat docs/deployment/security-headers.md

# Verify all deployment scenarios covered:
# - Vercel
# - Netlify
# - nginx
# - CloudFlare
```

**Expected**: Complete documentation for all hosting providers

## Success Criteria Checklist

Run this checklist to confirm all debt items are resolved:

```bash
# Critical Items
[ ] Next.js builds without dummy Pages Router files
[ ] Security headers documentation complete
[ ] Offline queue tests passing

# High Priority Items
[ ] ContactForm Storybook stories working
[ ] GoogleAnalytics stories rendering with context
[ ] PWA manifest generates at build time
[ ] All components follow 5-file structure

# Medium Priority Items
[ ] Bundle size < 90KB First Load JS
[ ] Maps and calendars lazy load properly
[ ] E2E tests run in GitHub Actions
[ ] Configuration simplified (no webpack workarounds)
```

## Performance Validation

```bash
# Run Lighthouse audit
pnpm run lighthouse

# Check metrics:
# - Performance: >90
# - Accessibility: >90
# - Best Practices: >90
# - SEO: >90
```

## Rollback Plan

If any fixes cause issues:

```bash
# Revert specific fix
git revert <commit-hash>

# Or reset to previous state
git reset --hard origin/main

# Restore dependencies
pnpm install
```

## Deployment Validation

After all fixes are verified:

```bash
# Build for production
pnpm run build

# Test production build locally
pnpm run start

# Deploy to staging
pnpm run deploy:staging

# Run smoke tests
pnpm run test:smoke
```

## Troubleshooting

### Build fails after removing dummy files

- Next.js bug not yet fixed
- Keep dummy files until next Next.js release

### Tests still failing

- Check test timeout settings
- Verify mock setup in new structure
- Run tests individually to isolate issues

### Storybook stories not working

- Clear Storybook cache: `rm -rf node_modules/.cache/storybook`
- Rebuild Storybook: `pnpm run build-storybook`
- Check decorator configuration

### Bundle size not reduced

- Run `pnpm analyze` to identify large dependencies
- Verify dynamic imports are working
- Check for duplicate dependencies

## Next Steps

Once all validations pass:

1. Merge to main branch
2. Tag release as v0.3.5
3. Update CHANGELOG.md
4. Close related GitHub issues
5. Proceed to Sprint 4 features

## Support

If you encounter issues:

- Check `/docs/TECHNICAL-DEBT.md` for known issues
- Review git history for recent changes
- Consult team in #dev-support channel
