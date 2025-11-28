# Product Requirements Prompt (PRP)

**Feature Name**: E2E Testing Framework (Playwright)  
**Priority**: P0 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

A comprehensive end-to-end testing framework using Playwright that tests critical user journeys across all major browsers. This will validate complete workflows including form submissions, theme switching, PWA installation, and accessibility features.

### Why We're Building It

- Constitutional requirement (Section 4: E2E Testing - Playwright framework)
- Currently marked as "❌ Sprint 3 Priority" in constitution
- Validates complete user journeys
- Ensures cross-browser compatibility
- Tests PWA features that unit tests can't cover
- Complements existing Vitest unit tests

### Success Criteria

- [ ] Playwright installed and configured
- [ ] Tests run in Chrome, Firefox, Safari
- [ ] Critical user journeys covered
- [ ] PWA installation flow tested
- [ ] Form submissions validated E2E
- [ ] Theme switching tested across pages
- [ ] Accessibility features tested
- [ ] CI/CD integration complete
- [ ] Tests run in Docker environment

### Out of Scope

- Mobile app testing (web only)
- Load/performance testing
- Visual regression (handled by Chromatic)
- API testing (UI flows only)

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Current Test Structure

```typescript
// Vitest unit tests at: src/__tests__/
const testFiles = [
  'components/Button.test.tsx',
  'components/Card.test.tsx',
  'components/Form.test.tsx',
  'components/Modal.test.tsx',
  'components/ThemeSwitcher.test.tsx',
];

// Test utilities at: src/test-utils.tsx
import { render } from '@testing-library/react';
```

#### Docker Configuration

```yaml
# docker-compose.yml
services:
  scripthammer:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
```

#### GitHub Actions CI

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm test
```

### Dependencies & Libraries

```bash
# Install Playwright
pnpm add -D @playwright/test

# Install browsers
pnpm dlx playwright install

# Docker support
pnpm dlx playwright install-deps
```

### File Structure

```
e2e/
├── tests/
│   ├── homepage.spec.ts       # Homepage tests
│   ├── theme-switching.spec.ts # Theme tests
│   ├── forms.spec.ts          # Form submission
│   ├── pwa.spec.ts            # PWA features
│   ├── accessibility.spec.ts  # A11y features
│   └── navigation.spec.ts     # Navigation flows
├── fixtures/
│   └── test-data.json         # Test data
└── playwright.config.ts       # Configuration
```

---

## 3. Technical Specifications

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000/CRUDkit',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000/CRUDkit',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Test Patterns

```typescript
// e2e/tests/theme-switching.spec.ts
import { test, expect } from '@playwright/test';

const themes = ['light', 'dark', 'synthwave', 'cyberpunk'];

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const theme of themes) {
    test(`should switch to ${theme} theme`, async ({ page }) => {
      // Open theme switcher
      await page.click('[data-testid="theme-switcher"]');

      // Select theme
      await page.click(`[data-theme="${theme}"]`);

      // Verify theme applied
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      // Verify persistence
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });
  }
});
```

### PWA Testing

```typescript
// e2e/tests/pwa.spec.ts
import { test, expect } from '@playwright/test';

test.describe('PWA Features', () => {
  test('should show install prompt', async ({ page, context }) => {
    // Navigate to app
    await page.goto('/');

    // Wait for service worker
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Check manifest
    const manifest = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return fetch(link.href).then((r) => r.json());
    });

    expect(manifest.name).toBe('CRUDkit');
    expect(manifest.display).toBe('standalone');
  });

  test('should work offline', async ({ page, context }) => {
    // Load page first
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Navigate should still work
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### Form Testing

```typescript
// e2e/tests/forms.spec.ts
test('should submit contact form', async ({ page }) => {
  await page.goto('/contact');

  // Fill form
  await page.fill('[name="name"]', 'Test User');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="message"]', 'Test message');

  // Submit
  await page.click('[type="submit"]');

  // Verify success
  await expect(page.locator('.alert-success')).toBeVisible();
});
```

### Performance Requirements

- Test execution: < 5 minutes for full suite
- Parallel execution: 4 workers max
- CI execution: < 10 minutes
- Local execution: < 3 minutes

---

## 4. Implementation Runbook

### Step 1: Install Playwright

```bash
# Install Playwright
pnpm add -D @playwright/test

# Install browsers
pnpm dlx playwright install

# Install system dependencies (for CI)
pnpm dlx playwright install-deps
```

### Step 2: Create Configuration

```bash
# Create config file
touch playwright.config.ts

# Create test directories
mkdir -p e2e/tests e2e/fixtures

# Add to .gitignore
echo "test-results/" >> .gitignore
echo "playwright-report/" >> .gitignore
```

### Step 3: Write Core Tests

1. **Homepage tests**: Navigation, component rendering
2. **Theme tests**: All 32 themes switching
3. **Form tests**: Validation, submission, error handling
4. **PWA tests**: Installation, offline mode, service worker
5. **Accessibility tests**: Keyboard nav, screen reader

### Step 4: Docker Integration

```dockerfile
# Update Dockerfile
RUN pnpm dlx playwright install-deps
RUN pnpm dlx playwright install
```

### Step 5: CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: corepack enable
      - run: pnpm install
      - run: pnpm dlx playwright install
      - run: pnpm run build
      - run: pnpm exec playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### Step 6: Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

### Step 7: Testing

- [ ] Run tests locally
- [ ] Run tests in Docker
- [ ] Run tests in CI
- [ ] Verify all browsers work
- [ ] Check report generation
- [ ] Validate offline testing

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] Next.js app running
- [x] Docker environment configured
- [x] GitHub Actions CI exists
- [x] Test data available

### During Implementation

- [ ] Tests run in all browsers
- [ ] PWA features testable
- [ ] Forms submit correctly
- [ ] Themes switch properly

### Post-Implementation

- [ ] All critical paths covered
- [ ] CI pipeline includes E2E
- [ ] Reports generated
- [ ] Documentation complete

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Flaky tests in CI
   **Mitigation**: Add retries, increase timeouts, use wait conditions

2. **Risk**: Browser installation issues in Docker
   **Mitigation**: Use playwright Docker image as base

3. **Risk**: Slow test execution
   **Mitigation**: Parallel execution, selective test runs

4. **Risk**: PWA tests unreliable
   **Mitigation**: Mock service worker for predictable behavior

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 4: E2E Testing)
- Docker Config: `/docker-compose.yml`
- CI Pipeline: `/.github/workflows/ci.yml`
- Test Utils: `/src/test-utils.tsx`

### External Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing PWAs with Playwright](https://playwright.dev/docs/pwa)
- [Playwright Docker Integration](https://playwright.dev/docs/docker)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox → Processed)

- [ ] Specification generated
- [ ] Plan created
- [ ] Tasks broken down
- [ ] Implementation started
- [ ] Completed on: [PENDING]

---

<!--
PRP for E2E Testing Framework
Generated from SpecKit constitution analysis
Validates complete user journeys
-->
