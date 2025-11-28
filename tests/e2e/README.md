# E2E Testing Framework

> **⚠️ IMPORTANT: These E2E tests are for LOCAL DEVELOPMENT ONLY**
>
> The E2E tests require a running development server and are not integrated with CI/CD.
> They are designed to run locally using `pnpm test:e2e` for development validation.
>
> **Why local-only?**
>
> - Tests require `pnpm dev` server (not static build)
> - CI/CD would need to run dev server in background
> - Designed for developer validation during development

## Overview

This directory contains the end-to-end (E2E) testing framework built with Playwright, following Test-Driven Development (TDD) principles and the Page Object Model (POM) pattern.

## Structure

```
e2e/
├── tests/              # Test specifications
│   ├── homepage.spec.ts
│   ├── theme-switching.spec.ts
│   ├── pwa-installation.spec.ts
│   ├── form-submission.spec.ts
│   ├── accessibility.spec.ts
│   └── cross-page-navigation.spec.ts
├── pages/              # Page Object Models
│   ├── BasePage.ts     # Base class with common functionality
│   ├── HomePage.ts     # Homepage specific methods
│   ├── ThemePage.ts    # Theme page specific methods
│   └── ComponentsPage.ts # Components page specific methods
├── fixtures/           # Test data
│   ├── test-data.json  # General test data
│   └── users.json      # User personas and profiles
└── README.md           # This file
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (optional, for containerized testing)

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm dlx playwright install
pnpm dlx playwright install-deps
```

### Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run tests in UI mode
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm test:e2e homepage.spec.ts

# Run tests for specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit

# Run tests on mobile viewport
pnpm test:e2e --project="Mobile Chrome"

# View test report
pnpm test:e2e:report
```

### Docker Testing

```bash
# Run tests in Docker container
docker compose exec crudkit pnpm test:e2e

# Run with specific browser
docker compose exec crudkit pnpm test:e2e --project=chromium
```

## Test Coverage

### Current Test Suites

1. **Homepage Navigation** (8 tests)
   - Page loading and title verification
   - Navigation to different sections
   - Progress badge display
   - Game demo functionality
   - Footer links
   - GitHub repository link
   - Skip navigation

2. **Theme Switching** (13+ tests)
   - All 32 themes switching
   - Theme persistence across reloads
   - Theme application across pages
   - Theme search functionality
   - Color preview verification
   - LocalStorage persistence
   - Smooth transitions
   - Parameterized tests for each theme

3. **PWA Installation** (13 tests)
   - Service Worker registration
   - Manifest file validation
   - Offline functionality
   - Install prompt behavior
   - Icon verification
   - Apple touch icons
   - Viewport meta tags
   - Theme color consistency
   - Maskable icons
   - App shortcuts
   - Lighthouse PWA criteria

4. **Form Submission** (12 tests)
   - Label and ARIA attributes
   - Required field indicators
   - Error message display
   - Valid data submission
   - Validation prevention
   - Help text association
   - Focus order maintenance
   - Data persistence
   - Form reset functionality
   - Disabled field behavior
   - Loading states
   - Multi-step navigation

5. **Accessibility** (16 tests)
   - Automated accessibility checks (axe-core)
   - Skip link functionality
   - Image alt text
   - Form input labels
   - Focus indicators
   - Heading hierarchy
   - ARIA landmarks
   - Color contrast (WCAG)
   - Font size controls
   - Keyboard navigation
   - Reduced motion support
   - Link text clarity
   - Error message association

6. **Cross-Page Navigation** (15 tests)
   - All page navigation
   - Browser back/forward
   - Menu consistency
   - Deep linking
   - 404 handling
   - Anchor links
   - External links (new tab)
   - Breadcrumb navigation
   - Theme preservation
   - Keyboard accessible navigation
   - Page transitions
   - Mobile menu
   - Scroll position reset
   - Active item highlighting

**Total**: 284 test cases across 4 browser configurations

## Page Object Model

### BasePage

The `BasePage` class provides common functionality:

```typescript
-navigate(path) - // Navigate to a page
  waitForLoad() - // Wait for page to load
  getTheme() - // Get current theme
  setTheme(name) - // Set a theme
  screenshot(name) - // Take screenshot
  isVisible(selector) - // Check element visibility
  clickWithRetry() - // Click with retry logic
  fillWithRetry() - // Fill form with retry
  getText(selector) - // Get element text
  expectURL(pattern); // Assert URL pattern
```

### Page-Specific Objects

Each page has its own class extending BasePage:

- **HomePage**: Hero section, navigation, game demo
- **ThemePage**: Theme selection, search, persistence
- **ComponentsPage**: Component interactions, forms

## Test Data

### test-data.json

Contains:

- Theme configurations
- Form validation data
- Navigation paths
- Component definitions
- PWA manifest data
- Accessibility settings
- Viewport configurations
- Timeout values

### users.json

Contains:

- Test user profiles
- User personas (developer, designer, end-user, a11y user)
- Session states
- Form data templates

## CI/CD Integration

### GitHub Actions

The `.github/workflows/e2e.yml` workflow:

- Runs on push/PR to main/develop
- Matrix testing across browsers
- Test sharding (4 parallel shards)
- Automatic artifact uploads
- PR comment integration
- Lighthouse CI integration

### Test Reports

Multiple reporters configured:

- HTML report (visual report)
- JSON report (CI integration)
- JUnit XML (test results)
- GitHub Actions annotations

## Best Practices

### Writing Tests

1. **Follow TDD**: Write tests first (RED), then implement (GREEN)
2. **Use Page Objects**: Don't interact with selectors directly in tests
3. **Keep Tests Independent**: Each test should be self-contained
4. **Use Test Data**: Leverage fixtures for consistency
5. **Add Retry Logic**: Use built-in retry for flaky operations
6. **Descriptive Names**: Use clear test descriptions

### Selectors

Priority order:

1. `data-testid` attributes (most reliable)
2. Role-based selectors (`[role="button"]`)
3. Text content (`text=Submit`)
4. CSS classes (least preferred)

### Debugging

```bash
# Run in debug mode
pnpm test:e2e:debug

# Run with headed browser
pnpm test:e2e --headed

# Slow down execution
pnpm test:e2e --slow-mo=1000

# Generate trace
pnpm test:e2e --trace on
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout in playwright.config.ts
   - Check network conditions
   - Verify selectors are correct

2. **Flaky tests**
   - Use `waitForLoad()` after navigation
   - Add retry logic for interactions
   - Check for race conditions

3. **Docker permission issues**
   - Run with proper user permissions
   - Check volume mounts

4. **Browser installation**

   ```bash
   # Reinstall browsers
   pnpm dlx playwright install --force
   ```

5. **Port conflicts**
   - Ensure port 3000 is available
   - Check Docker container status

### Debug Commands

```bash
# Check Playwright version
pnpm exec playwright --version

# List available browsers
pnpm exec playwright install --list

# Run specific test in debug
pnpm exec playwright test homepage.spec.ts --debug

# Generate codegen
pnpm exec playwright codegen http://localhost:3000/ScriptHammer
```

## Performance

### Optimization Tips

1. **Parallel Execution**: Tests run in parallel by default
2. **Sharding**: Use `--shard` for CI distribution
3. **Smart Waits**: Use Playwright's auto-waiting
4. **Reuse Context**: Share browser context when possible
5. **Selective Testing**: Use grep to run specific tests

### Benchmarks

- Average test execution: < 5 seconds per test
- Full suite execution: < 5 minutes locally
- CI execution: < 10 minutes with sharding

## Contributing

### Adding New Tests

1. Create test file in `e2e/tests/`
2. Follow naming convention: `feature-name.spec.ts`
3. Use Page Objects for interactions
4. Add test data to fixtures if needed
5. Update this README with test count

### Adding Page Objects

1. Create new class in `e2e/pages/`
2. Extend `BasePage`
3. Add page-specific selectors and methods
4. Keep methods focused and reusable

### Updating Fixtures

1. Add data to appropriate fixture file
2. Keep data organized by category
3. Use meaningful keys
4. Document complex data structures

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)

## License

Part of the ScriptHammer project. See main LICENSE file.
