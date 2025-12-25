# Testing Guidelines

## Overview

CRUDkit uses a comprehensive testing strategy to ensure code quality and reliability. Our testing stack includes:

- **Vitest**: Fast unit testing framework
- **React Testing Library**: Component testing utilities
- **Coverage Reports**: Track test coverage metrics
- **CI/CD Integration**: Automated testing on every push

## Testing Stack

### Core Dependencies

- `vitest`: Test runner and assertion library
- `@testing-library/react`: React component testing
- `@testing-library/jest-dom`: Custom DOM matchers
- `@vitest/ui`: Interactive test UI
- `@vitest/coverage-v8`: Coverage reporting
- `jsdom`: Browser environment simulation

## Running Tests

### Docker Commands (MANDATORY)

**⚠️ IMPORTANT**: This project REQUIRES Docker for all development and testing.

```bash
# Run all tests once
docker compose exec scripthammer pnpm test

# Run tests in watch mode
docker compose exec scripthammer pnpm test:watch

# Run tests with UI
docker compose exec scripthammer pnpm test:ui

# Generate coverage report
docker compose exec scripthammer pnpm test:coverage
```

**NOTE**: Local pnpm/npm commands are NOT supported. All testing MUST use Docker.

## Writing Tests

### Component Testing

Components should be tested for:

1. **Rendering**: Component renders without errors
2. **Props**: Props are handled correctly
3. **User Interactions**: Click, type, focus events work
4. **States**: Different states display correctly
5. **Accessibility**: ARIA attributes and roles are present

#### Example Component Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button Component', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Best Practices

1. **Use Testing Library Queries**: Prefer queries that reflect how users interact
   - Good: `getByRole`, `getByLabelText`, `getByPlaceholderText`
   - Avoid: `getByTestId` (unless necessary)

2. **Test User Behavior**: Focus on what users see and do

   ```typescript
   // Good: Test user-visible behavior
   expect(screen.getByRole('button')).toHaveTextContent('Submit');

   // Avoid: Test implementation details
   expect(component.state.isSubmitting).toBe(true);
   ```

3. **Keep Tests Isolated**: Each test should be independent

   ```typescript
   describe('Component', () => {
     // Reset mocks after each test
     afterEach(() => {
       vi.clearAllMocks();
     });
   });
   ```

4. **Use Descriptive Names**: Test names should explain what's being tested

   ```typescript
   // Good
   it('displays error message when email is invalid');

   // Avoid
   it('test email validation');
   ```

## Test Structure

### File Organization

```
src/
├── components/
│   ├── subatomic/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx  # Component test
│   │   │   └── Button.stories.tsx
│   │   └── Input/
│   │       ├── Input.tsx
│   │       └── Input.test.tsx
│   └── atomic/
│       └── Card/
│           ├── Card.tsx
│           └── Card.test.tsx
├── utils/
│   ├── theme.ts
│   └── theme.test.ts  # Utility test
└── test/
    └── setup.ts  # Test configuration
```

### Test Configuration

The test environment is configured in `vitest.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 10,
        branches: 10,
        functions: 10,
        lines: 10,
      },
    },
  },
});
```

## Coverage Requirements

### Current Thresholds

- **Statements**: 0.5%
- **Branches**: 0.5%
- **Functions**: 0.5%
- **Lines**: 0.5%

These thresholds will increase as the project matures:

- Sprint 2: 0.5% (current - minimal baseline)
- Sprint 3: 10%
- Sprint 4: 25%
- Sprint 5: 50%
- Sprint 6: 75%

### Viewing Coverage

```bash
# Generate coverage report (inside Docker)
docker compose exec scripthammer pnpm test:coverage

# Coverage report is generated in /coverage directory
# View it from your host machine:
open coverage/index.html
```

## Known Issues

### Colorblind Mode Tests (10 failures as of 2025-09-14)

The following tests are currently failing due to test implementation issues, not functionality bugs:

**ColorblindToggle Component (6 failures)**:

- Dropdown not rendering in test environment
- Tests looking for "Color Vision Settings" text that may be rendered differently
- Focus management tests failing due to dropdown behavior

**useColorblindMode Hook (3 failures)**:

- localStorage persistence tests expecting different state updates
- Pattern class toggle tests not detecting DOM changes correctly

**ColorblindFilters Component (1 failure)**:

- Parent element assertion failing in render test

These failures do not affect the actual functionality of the colorblind assistance feature, which works correctly in the application. The issues are related to test setup and expectations.

## Test Suite Architecture

### Vitest Exclusions (vitest.config.ts)

The main vitest suite excludes 105 tests across three categories:

#### TDD Placeholders (47 tests) - Features Not Yet Implemented

These tests intentionally fail with `expect(true).toBe(false)` until features are built:

- `tests/contract/email-notifications.test.ts` (17 tests) - Email Edge Function
- `tests/contract/stripe-webhook.test.ts` (14 tests) - Stripe webhook handling
- `tests/contract/paypal-webhook.test.ts` (15 tests) - PayPal webhook handling
- `tests/contract/profile/delete-account.contract.test.ts` (1 test) - Cascade delete

#### Real Tests Excluded for Rate Limits (52 tests)

Fully implemented but excluded to avoid hitting shared Supabase instance:

- `tests/integration/auth/oauth-flow.test.ts` (10 tests)
- `tests/integration/auth/password-reset-flow.test.ts` (7 tests)
- `tests/integration/auth/sign-in-flow.test.ts` (7 tests)
- `tests/integration/auth/sign-up-flow.test.ts` (6 tests)
- `tests/integration/auth/protected-routes.test.ts` (10 tests)
- `tests/contract/auth/*.test.ts` (7 tests)
- `tests/integration/messaging/database-setup.test.ts` (14 tests)

**Future work:** Re-enable when dedicated test Supabase instance available.

#### Canvas API Tests (6 tests) - Covered by E2E

Need real browser Canvas API, covered by Playwright E2E tests:

- `src/lib/avatar/__tests__/image-processing.test.ts` (6 tests)
- `src/lib/avatar/__tests__/validation.test.ts` (7 tests)
- `tests/integration/avatar/upload-flow.integration.test.ts` (5 tests)

### Test Count Summary

| Suite                  | Tests    | Notes                              |
| ---------------------- | -------- | ---------------------------------- |
| Vitest (main)          | ~2,300   | Runs by default                    |
| Excluded (TDD)         | 47       | Waiting for feature implementation |
| Excluded (rate limits) | 52       | Re-enable with dedicated test DB   |
| Excluded (Canvas)      | 6        | Covered by E2E                     |
| E2E (Playwright)       | 54 files | Run separately                     |

### Running Excluded Tests Manually

```bash
# Run integration auth tests (requires dedicated Supabase)
docker compose exec scripthammer pnpm test tests/integration/auth/ -- --run

# Run contract tests (some will fail - TDD placeholders)
docker compose exec scripthammer pnpm test tests/contract/ -- --run
```

## CI/CD Integration

Tests run automatically on:

- Every push to `main` or `develop`
- Every pull request

The CI pipeline (`/.github/workflows/ci.yml`) runs:

1. Linting
2. Type checking
3. Unit tests
4. Coverage check
5. Build verification

## Pre-commit Hooks

Husky runs tests on staged files before commit. Note that git hooks run on your host machine, but all testing commands are executed inside Docker:

```bash
# .husky/pre-commit
docker compose exec -T scripthammer pnpm lint-staged
```

Lint-staged configuration:

- **JS/TS files**: ESLint + related tests
- **CSS/MD/JSON**: Prettier formatting

## Debugging Tests

### Interactive Mode

```bash
# Open Vitest UI for debugging (inside Docker)
docker compose exec scripthammer pnpm test:ui

# Access the UI at http://localhost:51204 (or the port shown in terminal)
```

### VSCode Integration

Install the Vitest extension for:

- Run tests from editor
- Debug with breakpoints
- See inline coverage

### Common Issues

1. **Module not found**: Check import paths and aliases
2. **DOM not available**: Ensure `jsdom` environment is set
3. **Async issues**: Use `waitFor` for async operations
4. **React hooks errors**: Wrap in `renderHook` from testing library

## Testing Checklist

Before committing:

- [ ] All tests pass locally
- [ ] New features have tests
- [ ] Coverage hasn't decreased
- [ ] No console errors in tests
- [ ] Tests follow naming conventions
- [ ] Mocks are properly cleaned up

## E2E Testing with Playwright

### Overview

End-to-end tests use Playwright to test complete user workflows in real browsers. E2E tests are local-only (not run in CI) due to requiring authenticated sessions.

### Test Users Setup

E2E tests require multiple test users for multi-user scenarios (messaging, connections, group chats).

**⚠️ CRITICAL: Email Domain Requirement**

Supabase validates email domains and **rejects `@example.com`** emails. You MUST use a real email domain. Gmail plus aliases work perfectly:

```bash
# REQUIRED in .env for dynamically generated test emails
TEST_EMAIL_DOMAIN=yourname+e2e@gmail.com
```

Without `TEST_EMAIL_DOMAIN`, E2E tests will fail with "Email address is invalid" errors.

**Test Users (use Gmail plus aliases):**
| User | Email Example | Purpose |
|------|---------------|---------|
| Primary | yourname+test-a@gmail.com | Runs E2E tests |
| Secondary | yourname+test-b@gmail.com | Multi-user tests (connections, messaging) |
| Tertiary | yourname+test-c@gmail.com | Group chat tests (3+ members) |
| Admin | admin@scripthammer.com | Welcome messages |

**Setup (one-time):**

```bash
# 1. Create test users in Supabase
docker compose exec scripthammer pnpm exec tsx scripts/seed-test-users.ts

# 2. Create connections between users
docker compose exec scripthammer pnpm exec tsx scripts/seed-connections.ts
```

**Environment Variables (in .env):**

```bash
# REQUIRED - Dynamic test email generation
TEST_EMAIL_DOMAIN=yourname+e2e@gmail.com

# Pre-seeded test users (use Gmail plus aliases)
TEST_USER_PRIMARY_EMAIL=yourname+test-a@gmail.com
TEST_USER_PRIMARY_PASSWORD=<secure-password>
TEST_USER_SECONDARY_EMAIL=yourname+test-b@gmail.com
TEST_USER_SECONDARY_PASSWORD=<secure-password>
TEST_USER_TERTIARY_EMAIL=yourname+test-c@gmail.com
TEST_USER_TERTIARY_PASSWORD=<secure-password>
```

### Running E2E Tests

```bash
# Run all E2E tests (starts dev server automatically)
docker compose exec scripthammer pnpm exec playwright test

# Run specific test file
docker compose exec scripthammer pnpm exec playwright test tests/e2e/messaging/

# Run with existing dev server (faster)
SKIP_WEBSERVER=true docker compose exec -e SKIP_WEBSERVER=true scripthammer pnpm exec playwright test

# Run specific browser
docker compose exec scripthammer pnpm exec playwright test --project=chromium

# Run with UI (headed mode)
docker compose exec scripthammer pnpm exec playwright test --ui

# Generate HTML report
docker compose exec scripthammer pnpm exec playwright show-report
```

### Test Structure

```
tests/e2e/
├── messaging/
│   ├── complete-user-workflow.spec.ts    # Full messaging flow
│   ├── encrypted-messaging.spec.ts       # E2E encryption tests
│   ├── friend-requests.spec.ts           # Connection flows
│   ├── group-chat-multiuser.spec.ts      # Group chat with 3+ users
│   └── ...
└── auth/
    └── ...
```

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Sign in
      await page.goto('/sign-in');
      await page.fill('#email', process.env.TEST_USER_PRIMARY_EMAIL!);
      await page.fill('#password', process.env.TEST_USER_PRIMARY_PASSWORD!);
      await page.click('button[type="submit"]');

      // Test actions...
      await expect(page.locator('...')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
```

### Supabase Rate Limiting in E2E Tests

Supabase enforces rate limits that can cause E2E test failures. Understanding these limits is critical for reliable testing.

#### How Supabase Rate Limiting Works

| Type            | Scope       | Default            | Configurable             |
| --------------- | ----------- | ------------------ | ------------------------ |
| API Rate Limits | Per IP      | 30-360/hour        | Yes (via Management API) |
| Account Lockout | Per Email   | 5 failed attempts  | No (built-in security)   |
| Email Sending   | Per Project | 4/hour (free tier) | Yes (custom SMTP)        |

**Key Insight**: Login rate limiting is **IP-based**, not email-based. All tests running from the same CI runner share the same IP and rate limit bucket.

#### Symptoms of Rate Limiting

```
"Too many failed attempts. Your account has been temporarily locked. Please try again in 15 minutes."
```

This error indicates the account lockout feature triggered after 5+ failed login attempts.

#### Solutions for Rate Limiting Tests

**1. Run rate limiting tests in SERIAL mode:**

```typescript
// tests/e2e/auth/rate-limiting.spec.ts
test.describe.configure({ mode: 'serial' });

test.describe('Rate Limiting', () => {
  let sharedEmail: string;

  test.beforeAll(() => {
    // Generate ONE email for all tests
    sharedEmail = generateTestEmail('ratelimit');
  });

  test('1. triggers rate limit', async ({ page }) => {
    // Only THIS test triggers rate limiting
    for (let i = 0; i < 6; i++) {
      /* failed attempts */
    }
  });

  test('2. verifies lockout message', async ({ page }) => {
    // Verifies the ALREADY triggered rate limit
    // Only 1 attempt, not 6
  });
});
```

**2. Increase Supabase rate limits via Management API:**

```bash
# Check current limits
docker compose exec scripthammer node -e "
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = 'your-project-ref';
fetch(\`https://api.supabase.com/v1/projects/\${ref}/config/auth\`)
  .then(r => r.json())
  .then(d => console.log({
    rate_limit_verify: d.rate_limit_verify,
    rate_limit_token_refresh: d.rate_limit_token_refresh
  }));
"

# Increase limits for testing
docker compose exec scripthammer node -e "
fetch(\`https://api.supabase.com/v1/projects/\${ref}/config/auth\`, {
  method: 'PATCH',
  headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rate_limit_verify: 360 })
}).then(r => r.json()).then(console.log);
"
```

**3. Required environment variables:**

```bash
# .env - for Management API access
SUPABASE_ACCESS_TOKEN=sbp_xxx...
SUPABASE_PROJECT_REF=your-project-ref
```

#### Anti-Patterns to Avoid

```typescript
// ❌ BAD: Each test independently triggers rate limiting
test.describe('Rate Limiting', () => {
  test('test 1', async () => {
    for (i = 0; i < 6; i++) {
      /* attempt */
    }
  });
  test('test 2', async () => {
    for (i = 0; i < 6; i++) {
      /* attempt */
    }
  });
  test('test 3', async () => {
    for (i = 0; i < 6; i++) {
      /* attempt */
    }
  });
  // Result: 18+ attempts = IP blocked, tests 2 and 3 fail
});

// ❌ BAD: Assuming unique emails bypass rate limits
const email1 = generateEmail('test1');
const email2 = generateEmail('test2');
// This doesn't help - rate limiting is IP-based, not email-based
```

#### Playwright Project Ordering (Implemented Solution)

This project uses **Playwright project dependencies** to ensure rate-limiting tests run before sign-up tests can consume the IP quota:

```
playwright.config.ts project execution order:
┌──────────────────┐
│  rate-limiting   │  ← Runs FIRST (clean IP state)
└────────┬─────────┘
         │ depends on
┌────────▼─────────┐
│   brute-force    │  ← Runs second
└────────┬─────────┘
         │ depends on
┌────────▼─────────┐
│     signup       │  ← Runs LAST (can consume quota)
└──────────────────┘

┌──────────────────┐
│    chromium      │  ← Runs in parallel (excludes above tests)
│    firefox       │
│    webkit        │
│    Mobile-*      │
└──────────────────┘
```

**Key files:**

- `playwright.config.ts` - Defines project dependencies via `dependencies: ['rate-limiting']`
- `tests/e2e/utils/rate-limit-admin.ts` - Clears `rate_limit_attempts` table before tests
- `.github/workflows/e2e.yml` - Runs ordered projects first, then parallel tests

**How it works:**

1. Rate-limiting tests use `test.beforeAll()` to clear the custom `rate_limit_attempts` table
2. Playwright enforces project execution order via `dependencies`
3. The `chromium` project uses `testIgnore` to exclude rate-limiting/brute-force/signup tests
4. CI workflow runs ordered projects first, then remaining tests

#### For Forked Projects

If you're experiencing rate limiting issues in a fork:

1. **The project ordering is already configured** - tests should work out of the box
2. **Increase rate limits** via Management API if still seeing issues (see above)
3. **Verify SUPABASE_SERVICE_ROLE_KEY is set** - needed for rate limit table cleanup
4. **Consider skipping** rate limiting tests in CI if they test Supabase behavior, not your code

### Debugging E2E Tests

```bash
# Run with trace on failure
docker compose exec scripthammer pnpm exec playwright test --trace on

# View trace
docker compose exec scripthammer pnpm exec playwright show-trace test-results/*/trace.zip

# Run in debug mode (step through)
docker compose exec scripthammer pnpm exec playwright test --debug
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

---

_Last Updated: Feature 010 - Group Chats E2E Testing_
