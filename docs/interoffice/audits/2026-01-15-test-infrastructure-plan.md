# Test Infrastructure Plan

**Date**: 2026-01-15
**Author**: Test Engineer Terminal
**Status**: Planning Phase

## Executive Summary

This document defines the test infrastructure for ScriptHammer implementation, derived from constitution requirements in `.specify/memory/constitution.md`. The plan covers unit testing (Vitest), E2E testing (Playwright), and accessibility testing (Pa11y).

---

## Constitution Requirements Summary

| Requirement          | Target                    | Tool       |
| -------------------- | ------------------------- | ---------- |
| Unit test coverage   | 25% minimum               | Vitest     |
| E2E browser coverage | Chromium, Firefox, WebKit | Playwright |
| Accessibility        | WCAG 2.1 Level AA         | Pa11y      |
| API mocking          | Service isolation         | MSW        |
| Pre-push validation  | Automated gates           | Husky      |

---

## 1. Vitest Configuration

### vitest.config.ts

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',
    globals: true,

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Include patterns (5-file structure compliance)
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.accessibility.test.{ts,tsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', '.next', 'e2e/**'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Constitution: 25% minimum coverage
      thresholds: {
        global: {
          statements: 25,
          branches: 25,
          functions: 25,
          lines: 25,
        },
      },

      // Include application code only
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.accessibility.test.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
      ],
    },

    // Performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Reporters
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/vitest-results.json',
    },
  },

  // Path aliases (match tsconfig)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
```

### Test Setup File (src/test/setup.ts)

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';

// MSW server for API mocking
export const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Mock matchMedia (for responsive tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

---

## 2. Playwright Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Parallelization
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['list'],
  ],

  // Global settings
  use: {
    // Base URL for static export
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Tracing and screenshots
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Viewport (mobile-first, then desktop)
    viewport: { width: 375, height: 667 },

    // Accessibility testing support
    bypassCSP: true,
  },

  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  // Constitution: Chromium, Firefox, WebKit
  projects: [
    // Mobile-first (Constitution: Progressive Enhancement)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Desktop browsers
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // Accessibility project
    {
      name: 'Accessibility',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: '**/*.a11y.spec.ts',
    },
  ],

  // Web server (for local development)
  webServer: {
    command: 'pnpm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Output directories
  outputDir: 'test-results/playwright',
});
```

### E2E Test Structure

```
e2e/
├── fixtures/
│   ├── test-data.ts         # Shared test data
│   └── page-objects/        # Page object models
│       ├── BasePage.ts
│       ├── HomePage.ts
│       └── SettingsPage.ts
├── specs/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── logout.spec.ts
│   ├── navigation/
│   │   └── routing.spec.ts
│   └── features/
│       └── [feature].spec.ts
├── a11y/
│   ├── home.a11y.spec.ts
│   └── [page].a11y.spec.ts
└── global-setup.ts
```

---

## 3. Pa11y Configuration

### .pa11yrc.json

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "runners": ["axe", "htmlcs"],
    "timeout": 30000,
    "wait": 1000,
    "chromeLaunchConfig": {
      "args": ["--no-sandbox", "--disable-setuid-sandbox"]
    },
    "viewport": {
      "width": 1280,
      "height": 720
    },
    "hideElements": "[data-pa11y-ignore]",
    "ignore": []
  },
  "urls": [
    {
      "url": "http://localhost:3000",
      "screenCapture": "./pa11y-results/screenshots/home.png"
    },
    {
      "url": "http://localhost:3000/settings",
      "screenCapture": "./pa11y-results/screenshots/settings.png"
    }
  ]
}
```

### Pa11y CI Configuration (.pa11yci)

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "runners": ["axe", "htmlcs"],
    "timeout": 30000,
    "chromeLaunchConfig": {
      "args": ["--no-sandbox", "--disable-setuid-sandbox"]
    },
    "threshold": 0
  },
  "urls": [
    "http://localhost:3000",
    "http://localhost:3000/settings",
    "http://localhost:3000/profile"
  ]
}
```

### Pa11y Test Runner Script (scripts/pa11y-test.ts)

```typescript
import pa11y from 'pa11y';
import { writeFileSync, mkdirSync } from 'fs';

interface Pa11yResult {
  documentTitle: string;
  pageUrl: string;
  issues: Pa11yIssue[];
}

interface Pa11yIssue {
  code: string;
  type: 'error' | 'warning' | 'notice';
  message: string;
  context: string;
  selector: string;
}

const URLS = [
  '/',
  '/settings',
  '/profile',
  // Add all routes from features
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runPa11yTests(): Promise<void> {
  const results: Pa11yResult[] = [];
  const errors: Pa11yIssue[] = [];

  console.log('🔍 Running Pa11y accessibility tests...\n');

  for (const url of URLS) {
    const fullUrl = `${BASE_URL}${url}`;
    console.log(`Testing: ${fullUrl}`);

    try {
      const result = await pa11y(fullUrl, {
        standard: 'WCAG2AA',
        runners: ['axe', 'htmlcs'],
        timeout: 30000,
        chromeLaunchConfig: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      });

      results.push(result);

      const issueCount = result.issues.filter((i) => i.type === 'error').length;
      if (issueCount > 0) {
        console.log(`  ❌ ${issueCount} error(s) found`);
        errors.push(...result.issues.filter((i) => i.type === 'error'));
      } else {
        console.log(`  ✅ No errors`);
      }
    } catch (error) {
      console.log(`  ⚠️ Failed to test: ${error}`);
    }
  }

  // Write results
  mkdirSync('./pa11y-results', { recursive: true });
  writeFileSync(
    './pa11y-results/report.json',
    JSON.stringify(results, null, 2)
  );

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Pages tested: ${results.length}`);
  console.log(`   Total errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Accessibility tests failed');
    process.exit(1);
  }

  console.log('\n✅ All accessibility tests passed');
}

runPa11yTests();
```

---

## 4. Component Test Template

### 5-File Pattern Compliance

Each component requires these test files:

```
src/components/[ComponentName]/
├── index.tsx                          # Re-export
├── [ComponentName].tsx                # Implementation
├── [ComponentName].test.tsx           # Unit tests
├── [ComponentName].stories.tsx        # Storybook
└── [ComponentName].accessibility.test.tsx  # A11y tests
```

### Unit Test Template (\*.test.tsx)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  // Render tests
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<ComponentName />);
      expect(screen.getByRole('...')).toBeInTheDocument();
    });

    it('displays correct content', () => {
      render(<ComponentName title="Test" />);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  // Interaction tests
  describe('interactions', () => {
    it('handles click events', () => {
      const onClick = vi.fn();
      render(<ComponentName onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('handles empty props gracefully', () => {
      render(<ComponentName />);
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });
  });
});
```

### Accessibility Test Template (\*.accessibility.test.tsx)

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { ComponentName } from './ComponentName';

expect.extend(toHaveNoViolations);

describe('ComponentName Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<ComponentName />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has proper ARIA attributes', () => {
    const { getByRole } = render(<ComponentName />);
    const element = getByRole('button');
    expect(element).toHaveAttribute('aria-label');
  });

  it('is keyboard navigable', () => {
    const { getByRole } = render(<ComponentName />);
    const element = getByRole('button');
    element.focus();
    expect(element).toHaveFocus();
  });

  it('has visible focus indicators', () => {
    const { getByRole } = render(<ComponentName />);
    const element = getByRole('button');
    element.focus();
    // Check computed styles for focus ring
    const styles = window.getComputedStyle(element);
    expect(styles.outline).not.toBe('none');
  });

  // Constitution: 44px minimum touch targets
  it('meets touch target size requirements', () => {
    const { getByRole } = render(<ComponentName />);
    const element = getByRole('button');
    const rect = element.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  });
});
```

---

## 5. Package Dependencies

### package.json (test dependencies)

```json
{
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^22.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "axe-core": "^4.10.0",
    "jest-axe": "^9.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.6.0",
    "pa11y": "^8.0.0",
    "pa11y-ci": "^3.1.0",
    "vitest": "^2.1.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:a11y": "pa11y-ci",
    "test:a11y:single": "pa11y",
    "test:all": "pnpm test:coverage && pnpm test:e2e && pnpm test:a11y"
  }
}
```

---

## 6. Docker Integration

### docker-compose.test.yml

```yaml
version: '3.8'

services:
  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test
    volumes:
      - .:/app
      - /app/node_modules
      - ./coverage:/app/coverage
      - ./test-results:/app/test-results
      - ./playwright-report:/app/playwright-report
      - ./pa11y-results:/app/pa11y-results
    environment:
      - CI=true
      - BASE_URL=http://app:3000
    depends_on:
      - app
    command: pnpm test:all

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=test
```

### Dockerfile.test

```dockerfile
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Default command
CMD ["pnpm", "test:all"]
```

---

## 7. Husky Pre-Push Hook

### .husky/pre-push

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🧪 Running pre-push validation..."

# Run unit tests with coverage check
pnpm test:coverage --run || {
  echo "❌ Unit tests failed"
  exit 1
}

# Run accessibility tests
pnpm test:a11y || {
  echo "❌ Accessibility tests failed"
  exit 1
}

echo "✅ All pre-push checks passed"
```

---

## 8. CI/CD Integration

### .github/workflows/test.yml

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm test:coverage --run

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Build application
        run: pnpm build

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  accessibility-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build

      - name: Start server
        run: pnpm start &

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run Pa11y tests
        run: pnpm test:a11y
```

---

## 9. Quality Gates Summary

| Gate                     | Threshold | Enforcement     |
| ------------------------ | --------- | --------------- |
| Unit test coverage       | ≥25%      | CI + pre-push   |
| Accessibility errors     | 0         | CI + pre-push   |
| E2E test pass rate       | 100%      | CI              |
| TypeScript errors        | 0         | CI + pre-commit |
| Lighthouse Performance   | ≥90       | Manual review   |
| Lighthouse Accessibility | ≥95       | Manual review   |

---

## 10. Test Execution Commands

```bash
# Unit tests
pnpm test                    # Run all unit tests
pnpm test:watch              # Watch mode
pnpm test:coverage           # With coverage report
pnpm test:ui                 # Visual UI

# E2E tests
pnpm test:e2e                # Run all E2E tests
pnpm test:e2e --project=Mobile\ Chrome  # Specific browser
pnpm test:e2e:ui             # Visual UI
pnpm test:e2e:debug          # Debug mode

# Accessibility tests
pnpm test:a11y               # Run Pa11y CI
pnpm test:a11y:single http://localhost:3000  # Single URL

# Full suite
pnpm test:all                # Unit + E2E + A11y
```

---

## Next Steps

1. **Implementation Phase**: Create actual config files when codebase exists
2. **Component Generator**: Update to include test file templates
3. **Storybook Integration**: Add visual regression testing
4. **Performance Testing**: Add Lighthouse CI configuration

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-15
