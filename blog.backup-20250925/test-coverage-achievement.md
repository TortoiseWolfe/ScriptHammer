---
title: 'Testing Journey: From 0% to 58% Coverage in 4 Weeks'
slug: 'test-coverage-achievement'
excerpt: 'Discover how we built comprehensive testing from zero, why 58% coverage is our sweet spot, and the testing strategies that transformed our codebase.'
author: 'TortoiseWolfe'
publishDate: 2025-11-08
status: 'published'
featured: false
categories:
  - Testing
  - Quality
  - Development
tags:
  - testing
  - coverage
  - quality
  - vitest
  - tdd
readTime: 9
ogImage: '/blog-images/2025-11-08-test-coverage-achievement.png'
---

# Testing Journey: From 0% to 58% Coverage in 4 Weeks

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## Day 1: The Honest Testing Assessment 😅

When I first ran our testing coverage command, the results were brutally honest:

```bash
docker compose exec scripthammer pnpm test:coverage

Coverage: 0%
Tests: 0
Confidence: None
Bugs: Yes
```

We had no tests—zero, nada, zilch. Furthermore, this testing void meant every deployment was a leap of faith.

## Week 1: The Low-Hanging Fruit 🍎

```typescript
// Started with utilities (easy wins)
describe('formatDate', () => {
  it('formats dates correctly', () => {
    expect(formatDate('2024-01-01')).toBe('Jan 1, 2024');
  });
});

// Coverage: 0% → 12%
// Confidence: Growing
```

Utility functions are the easiest testing targets—pure functions with no mocks needed. Moreover, these tests discovered several edge cases we hadn't considered.

## Week 2: Component Testing 🧩

```typescript
// Button.test.tsx
describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

// Coverage: 12% → 28%
```

Components with comprehensive testing become components you can trust. Additionally, our testing revealed that several components had subtle bugs in edge cases.

## Week 3: The Hooks Challenge 🎣

```typescript
// useAuth.test.ts
describe('useAuth', () => {
  it('handles login flow', async () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.login('user@example.com', 'password');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
  });
});

// Coverage: 28% → 41%
```

Testing React hooks proved tricky initially, but we discovered the power of renderHook. Furthermore, hook testing revealed synchronization issues we'd been ignoring.

## Week 4: Integration Tests 🔗

```typescript
// Full user flow tests
describe('User Journey', () => {
  it('completes signup flow', async () => {
    render(<App />);

    // Navigate to signup
    await userEvent.click(screen.getByText('Sign Up'));

    // Fill form
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Test123!');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    // Verify success
    await waitFor(() => {
      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });
  });
});

// Coverage: 41% → 52%
```

Integration tests caught real bugs.

## The 58% Plateau (And Why It's OK) 📊

```bash
docker compose exec scripthammer pnpm test:coverage

File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
All files         |   58.32 |    52.14 |   61.23 |   58.32 |
 components       |   72.45 |    68.32 |   74.12 |   72.45 |
 hooks           |   64.23 |    61.45 |   66.78 |   64.23 |
 utils           |   91.34 |    89.23 |   92.45 |   91.34 |
 pages           |   42.12 |    38.45 |   45.23 |   42.12 |
```

Why we stopped at 58%:

- Diminishing returns
- UI code hard to test
- Time vs value tradeoff

## The Testing Strategy 🎯

```typescript
// What we test thoroughly (90%+ coverage)
- Business logic
- Utilities
- Custom hooks
- API calls
- Critical paths

// What we test lightly (30-50% coverage)
- UI components (visual regression instead)
- Third-party integrations
- Generated code
- Config files

// What we don't test (0% coverage)
- Console logs
- Dev-only code
- Temporary features
```

## The Real Benefits 💰

**Before tests**:

- Deploy anxiety: Maximum
- Refactoring: Scary
- Bug reports: Daily
- Debugging time: Hours

**After 58% coverage**:

- Deploy anxiety: Minimal
- Refactoring: Confident
- Bug reports: Weekly
- Debugging time: Minutes

## The Testing Pyramid 🔺

```
        /\        E2E Tests (5%)
       /  \       - Critical paths only
      /----\      Integration Tests (25%)
     /      \     - User flows
    /--------\    Unit Tests (70%)
   /          \   - Components, utils, hooks
```

## Continuous Testing 🔄

```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: |
    docker compose exec scripthammer pnpm test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    threshold: 55% # Fail if below

- name: Comment PR with coverage
  uses: 5monkeys/cobertura-action@master
  with:
    minimum_coverage: 55
```

## The Test Writing Workflow 📝

```bash
# 1. Write test first (TDD)
docker compose exec scripthammer pnpm test:watch

# 2. See it fail (red)
FAIL: formatCurrency should format numbers

# 3. Write code to pass (green)
PASS: formatCurrency should format numbers

# 4. Refactor (still green)
PASS: All tests passing
```

## Testing Tips That Saved Us 💡

```typescript
// 1. Use data-testid for reliable selection
<button data-testid="submit-button">Submit</button>
screen.getByTestId('submit-button');

// 2. Mock strategically
vi.mock('@/lib/api', () => ({
  fetchUser: vi.fn().mockResolvedValue(mockUser)
}));

// 3. Test behavior, not implementation
// Bad: expect(useState).toHaveBeenCalled()
// Good: expect(screen.getByText('Loading')).toBeInTheDocument()

// 4. Use factories for test data
const createUser = (overrides = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  ...overrides
});
```

## The Coverage Report Dashboard 📈

```typescript
// Generate beautiful HTML report
docker compose exec scripthammer pnpm test:coverage --reporter=html

// Open coverage/index.html
// See exactly what's not tested
// Red lines = not covered
// Green lines = covered
// Yellow = partially covered
```

## Start Your Testing Journey

```bash
# Install testing tools
docker compose exec scripthammer pnpm add -D vitest @testing-library/react

# Write your first test
echo "describe('First test', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});" > src/first.test.ts

# Run it
docker compose exec scripthammer pnpm test

# You're on your way!
```

58% isn't 100%.
But it's infinitely better than 0%.

Start testing today. Your future self will thank you.
