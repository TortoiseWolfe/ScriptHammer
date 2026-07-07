# Test Suite Troubleshooting Guide

This guide helps resolve common issues with the CRUDkit test suite.

## Running the Complete Test Suite

```bash
# Run comprehensive test suite
./scripts/test-suite.sh

# Run individual test commands
docker compose exec scripthammer pnpm run type-check    # TypeScript
docker compose exec scripthammer pnpm run lint           # ESLint
docker compose exec scripthammer pnpm run format:check   # Prettier
docker compose exec scripthammer pnpm test              # Unit tests
docker compose exec scripthammer pnpm run test:coverage # Coverage
docker compose exec scripthammer pnpm run test:a11y     # Accessibility
```

## Common Issues and Solutions

### 1. Test Coverage Reporting Issues

**Problem**: Coverage shows incorrect percentages or includes bundle files

**Solution**: The coverage configuration has been updated to exclude:

- Bundle files (`**/*.bundle.js`)
- Storybook static files
- Mock and test files
- Service worker files

**Current Coverage Thresholds**: 25% for all metrics

If coverage still shows issues, check that vitest.config.ts excludes all generated files.

### 2. Accessibility Test False Positives

**Problem**: Pa11y reports missing `lang` and `title` attributes that actually exist

**Root Cause**: Pa11y tests the initial HTML before Next.js hydration completes

**Solutions Applied**:

- Added 2-second wait time for hydration
- Configured proper timeout settings

**Alternative**: Use Playwright E2E tests for accessibility:

```bash
docker compose exec scripthammer pnpm run e2e:accessibility
```

### 3. Prettier Formatting Errors

**Problem**: Template files (.hbs) and some YAML files cause formatting errors

**Solution**: These files are now excluded in `.prettierignore`:

- Handlebars templates (`*.hbs`)
- Complex YAML specifications
- Generated JSON files

To fix formatting issues:

```bash
docker compose exec scripthammer pnpm run format
```

### 4. Docker Permission Issues

**Status**: ✅ FIXED

The `.next` directory permission issues have been permanently resolved with anonymous Docker volumes. No manual intervention needed.

### 5. Port 3000 Already in Use

**Problem**: Dev server fails to start

**Solution**:

```bash
docker compose down
lsof -i :3000
kill -9 <PID>
docker compose up
```

## Known Test Limitations

### Integration Tests

- 4 offline integration tests fail due to React Hook Form async validation timing
- Production functionality works correctly
- See `/docs/testing/KNOWN-TEST-ISSUES.md` for details

### E2E Tests

- Run locally only, not in CI pipeline
- Require dev server to be running
- Use Playwright for comprehensive browser testing

## Test Coverage Goals

| Metric     | Current | Target | Status |
| ---------- | ------- | ------ | ------ |
| Statements | ~41%    | 60%    | 🔴     |
| Branches   | ~38%    | 60%    | 🔴     |
| Functions  | ~39%    | 60%    | 🔴     |
| Lines      | ~41%    | 60%    | 🔴     |

## Quick Validation Commands

```bash
# Quick check (type, lint, unit tests)
docker compose exec scripthammer pnpm run test:quick

# Full validation before commit
docker compose exec scripthammer pnpm run test:suite
```

## Debugging Tips

### Vitest Coverage

```bash
# Generate HTML coverage report
docker compose exec scripthammer pnpm run test:coverage
# Open coverage/index.html in browser
```

### Pa11y Accessibility

```bash
# Generate screenshots during tests
docker compose exec scripthammer pnpm run test:a11y
# Check .pa11y-screenshots/ directory
```

### Component Structure

```bash
# Validate all components
docker compose exec scripthammer node scripts/validate-structure.js
```

## When All Else Fails

1. Clean Docker environment:

   ```bash
   pnpm run docker:clean
   ```

2. Clear all caches:

   ```bash
   rm -rf .next node_modules coverage
   docker compose down -v
   docker compose up --build
   ```

3. Reinstall dependencies:
   ```bash
   docker compose exec scripthammer pnpm install
   ```
