# E2E Testing Framework Quickstart Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites

- Node.js 18+ installed
- pnpm package manager
- CRUDkit app running locally

### Step 1: Install Playwright

```bash
# Install Playwright test framework
pnpm add -D @playwright/test

# Install browsers (Chrome, Firefox, Safari)
pnpm dlx playwright install

# Install system dependencies (Linux only)
pnpm dlx playwright install-deps
```

### Step 2: Create Your First Test

Create `e2e/tests/homepage.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('homepage has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/CRUDkit/);
});

test('can navigate to themes', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Browse Themes');
  await expect(page).toHaveURL(/.*themes/);
});
```

### Step 3: Run Tests

```bash
# Run all tests
pnpm exec playwright test

# Run with UI mode (interactive)
pnpm exec playwright test --ui

# Run in specific browser
pnpm exec playwright test --project=chromium
```

### Step 4: View Test Report

```bash
# Open HTML report
pnpm exec playwright show-report
```

## 📁 Project Structure

```
e2e/
├── tests/                    # Test files
│   ├── homepage.spec.ts     # Homepage tests
│   ├── themes.spec.ts       # Theme switching tests
│   └── pwa.spec.ts          # PWA tests
├── pages/                   # Page Object Models
│   ├── BasePage.ts         # Base page class
│   └── HomePage.ts         # Homepage methods
├── fixtures/               # Test data
│   └── test-data.json     # User data, themes, etc.
└── playwright.config.ts    # Configuration
```

## ⚙️ Configuration

### Basic Configuration

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000/CRUDkit',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
  ],

  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000/CRUDkit',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report"
  }
}
```

## 🧪 Writing Tests

### Page Object Pattern

Create `e2e/pages/HomePage.ts`:

```typescript
import { Page } from '@playwright/test';

export class HomePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async getTitle() {
    return await this.page.title();
  }

  async clickThemeSwitcher() {
    await this.page.click('[data-testid="theme-switcher"]');
  }

  async selectTheme(theme: string) {
    await this.page.click(`[data-theme="${theme}"]`);
  }
}
```

Use in tests:

```typescript
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';

test('can switch themes', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();
  await homePage.clickThemeSwitcher();
  await homePage.selectTheme('dark');

  const theme = await page.getAttribute('html', 'data-theme');
  expect(theme).toBe('dark');
});
```

### Testing PWA Features

```typescript
test('PWA is installable', async ({ page }) => {
  await page.goto('/');

  // Check manifest
  const manifest = await page.evaluate(() => {
    const link = document.querySelector('link[rel="manifest"]');
    return fetch(link.href).then((r) => r.json());
  });

  expect(manifest.name).toBe('CRUDkit');
  expect(manifest.display).toBe('standalone');
});

test('works offline', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Go offline
  await context.setOffline(true);

  // Should still work
  await page.reload();
  await expect(page.locator('h1')).toContainText('CRUDkit');
});
```

## 🐳 Docker Integration

### Dockerfile Addition

```dockerfile
# Install Playwright browsers
RUN pnpm dlx playwright install-deps
RUN pnpm dlx playwright install chromium firefox webkit
```

### docker-compose.yml

```yaml
services:
  e2e:
    build: .
    command: pnpm test:e2e
    environment:
      - CI=true
    volumes:
      - ./test-results:/app/test-results
      - ./playwright-report:/app/playwright-report
```

## 🔄 CI/CD Integration

### GitHub Actions

Create `.github/workflows/e2e.yml`:

```yaml
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
        with:
          node-version: 18

      - run: corepack enable
      - run: pnpm install

      - name: Install Playwright Browsers
        run: pnpm dlx playwright install --with-deps

      - name: Run Playwright tests
        run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## 🎯 Best Practices

### 1. Test Independence

Each test should be able to run in isolation:

```typescript
test.beforeEach(async ({ page }) => {
  // Reset to known state
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
```

### 2. Use Data Attributes

Add test-specific selectors:

```html
<button data-testid="submit-button">Submit</button>
```

```typescript
await page.click('[data-testid="submit-button"]');
```

### 3. Wait Strategies

Use proper wait conditions:

```typescript
// Good - waits for specific condition
await page.waitForSelector('.loading', { state: 'hidden' });
await page.click('button');

// Bad - arbitrary wait
await page.waitForTimeout(5000);
await page.click('button');
```

### 4. Debugging

```typescript
// Pause test execution
await page.pause();

// Take screenshot
await page.screenshot({ path: 'debug.png' });

// Enable verbose logging
DEBUG=pw:api pnpm test:e2e
```

## 📊 Reporting

### HTML Report

Default reporter with screenshots and videos:

```bash
pnpm exec playwright show-report
```

### JSON Report

For CI integration:

```typescript
// playwright.config.ts
reporter: [['json', { outputFile: 'test-results.json' }]];
```

### JUnit Report

For test management tools:

```typescript
reporter: [['junit', { outputFile: 'results.xml' }]];
```

## 🚨 Troubleshooting

### Common Issues

1. **Tests timeout**
   - Increase timeout: `test.setTimeout(60000)`
   - Check selectors are correct
   - Ensure app is running

2. **Flaky tests**
   - Add proper wait conditions
   - Use `test.retry(2)` for problematic tests
   - Check for race conditions

3. **CI failures**
   - Use headless mode
   - Install system dependencies
   - Check environment variables

### Debug Commands

```bash
# Run single test file
pnpm exec playwright test homepage.spec.ts

# Run tests with specific title
pnpm exec playwright test -g "should load"

# Debug mode
pnpm exec playwright test --debug

# Headed mode (see browser)
pnpm exec playwright test --headed

# Slow motion
pnpm exec playwright test --headed --slow-mo=1000
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-test)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)

## ✅ Checklist

- [ ] Playwright installed
- [ ] Configuration created
- [ ] First test written and passing
- [ ] All browsers tested
- [ ] CI pipeline configured
- [ ] Team trained on basics

---

**Next Steps**: Run `/tasks` command to generate detailed implementation tasks
