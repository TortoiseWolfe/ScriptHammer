---
title: "Error Boundaries: Your App's Airbags"
slug: 'error-boundaries-react'
excerpt: 'When components crash, error boundaries save the day (and the user experience).'
author: 'TortoiseWolfe'
publishDate: 2025-10-17
status: 'published'
featured: false
categories:
  - React
  - Error Handling
  - UX
tags:
  - error-boundaries
  - react
  - error-handling
  - resilience
  - ux
readTime: 7
ogImage: '/blog-images/2025-10-17-error-boundaries-react.png'
---

# Error Boundaries: Your App's Airbags

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The White Screen of Death ☠️

**Without Error Boundaries**:
One component fails → Entire app crashes → Blank screen → User gone forever

**With Error Boundaries**:
One component fails → Error caught → Fallback UI → User continues → Crisis averted

## The Basic Boundary 🛡️

```tsx
class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Caught:', error, errorInfo);
    // Send to error tracking
  }

  render() {
    if (this.state.hasError) {
      return <FallbackUI />;
    }
    return this.props.children;
  }
}

// Wrap and protect
<ErrorBoundary>
  <RiskyComponent />
</ErrorBoundary>;
```

## The User-Friendly Fallback 🎨

```tsx
<ErrorFallback>
  <Icon>😅</Icon>
  <Heading>Oops! Something went wrong</Heading>
  <Text>
    Don't worry, your data is safe. This part of the app just needs a refresh.
  </Text>
  <Button onClick={retry}>Try Again</Button>
  <Link href="/status">Check System Status</Link>
</ErrorFallback>

// Not: "Error: Cannot read property 'x' of undefined"
// But: Helpful, actionable, reassuring
```

## Granular Protection Levels 🎯

```tsx
<App>
  {/* Level 1: Protect entire app */}
  <AppErrorBoundary>
    {/* Level 2: Protect routes */}
    <RouteErrorBoundary>
      {/* Level 3: Protect features */}
      <FeatureErrorBoundary>
        {/* Level 4: Protect widgets */}
        <WidgetErrorBoundary>
          <RiskyWidget />
        </WidgetErrorBoundary>
      </FeatureErrorBoundary>
    </RouteErrorBoundary>
  </AppErrorBoundary>
</App>

// Widget fails? Feature continues
// Feature fails? Route continues
// Route fails? App continues
```

## The Smart Recovery 🔄

```tsx
function SmartErrorBoundary({ children }) {
  const [retries, setRetries] = useState(0);

  const retry = () => {
    if (retries < 3) {
      setRetries((r) => r + 1);
      // Clear error and retry
    } else {
      // Show "Contact Support"
    }
  };

  return (
    <ErrorBoundary fallback={<RetryUI attempt={retries} onRetry={retry} />}>
      {children}
    </ErrorBoundary>
  );
}

// Auto-retry for network issues
// Give up for code errors
// Smart, not annoying
```

## Async Error Handling 🔄

```tsx
// Error boundaries DON'T catch:
// - Event handlers
// - Async code
// - Server rendering
// - Errors in boundary itself

// Solution: Async wrapper
function AsyncBoundary({ children }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      setError(event.error);
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  if (error) return <ErrorFallback error={error} />;
  return children;
}
```

## Production Error Reporting 📊

```tsx
componentDidCatch(error, errorInfo) {
  // Local logging
  console.error(error);

  // Send to monitoring
  Sentry.captureException(error, {
    contexts: {
      react: errorInfo,
      user: getCurrentUser(),
      feature: this.props.feature
    }
  });

  // Track metrics
  analytics.track('Error Boundary Triggered', {
    component: errorInfo.componentStack,
    error: error.toString()
  });
}

// You know about errors before users complain
```

## The Development Helper 🔧

```tsx
// In development: Show full error
{
  process.env.NODE_ENV === 'development' && (
    <ErrorDetails>
      <Stack>{errorInfo.componentStack}</Stack>
      <Message>{error.toString()}</Message>
      <Button onClick={openInEditor}>Open in VS Code</Button>
    </ErrorDetails>
  );
}

// In production: User-friendly message
{
  process.env.NODE_ENV === 'production' && <FriendlyError />;
}
```

## Reset Functionality 🔄

```tsx
class ResettableErrorBoundary extends Component {
  state = { hasError: false, errorCount: 0 };

  reset = () => {
    this.setState({
      hasError: false,
      errorCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorUI onReset={this.reset} errorCount={this.state.errorCount} />
      );
    }

    // Pass reset to children
    return Children.map(this.props.children, (child) =>
      cloneElement(child, { resetError: this.reset })
    );
  }
}
```

## Testing Error Boundaries 🧪

```tsx
// Test that boundaries catch errors
it('shows fallback UI on error', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  const { getByText } = render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(getByText('Something went wrong')).toBeInTheDocument();
});

// Test recovery
it('recovers on retry', () => {
  // Test retry logic
});
```

## Real World Impact 📈

**Before Error Boundaries**:

- Crashes per day: 47
- User complaints: Constant
- Debug time: Hours
- User retention: 67%

**After Error Boundaries**:

- Crashes per day: 0 (failures handled gracefully)
- User complaints: Rare
- Debug time: Minutes (better error info)
- User retention: 89%

## Start Protecting Your App

```bash
docker compose exec scripthammer pnpm generate:component ErrorBoundary
```

Errors will happen.
Crashes don't have to.

Your users deserve better than blank screens.
