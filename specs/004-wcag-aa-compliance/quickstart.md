# WCAG AA Compliance - Developer Quickstart Guide (Simplified)

## Overview

Quick setup guide for WCAG AA compliance using Storybook addon-a11y and Pa11y CI.

## Prerequisites

- Docker running with CRUDkit containers
- Storybook accessible at localhost:6006

## Quick Setup (3 minutes)

### 1. Install Dependencies

```bash
# Install Storybook a11y addon and jest-axe
docker compose exec scripthammer pnpm add -D @storybook/addon-a11y jest-axe @types/jest-axe
```

### 2. Configure Storybook

Update `.storybook/main.ts` to add the addon:

```typescript
addons: [
  '@storybook/addon-onboarding',
  '@storybook/addon-links',
  '@storybook/addon-docs',
  '@chromatic-com/storybook',
  '@storybook/addon-themes',
  '@storybook/addon-a11y', // Add this line
];
```

### 3. Create Pa11y Configuration

Create `.pa11yci`:

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 10000,
    "wait": 500,
    "viewport": { "width": 1280, "height": 720 },
    "chromeLaunchConfig": {
      "args": ["--no-sandbox", "--disable-setuid-sandbox"]
    },
    "runners": ["htmlcs", "axe"],
    "threshold": 0,
    "ignore": []
  },
  "urls": [
    {
      "url": "http://localhost:3000/CRUDkit",
      "label": "Homepage"
    }
  ],
  "reporters": ["cli", "json"]
}
```

### 3. Add Scripts to package.json

```json
{
  "scripts": {
    "test:a11y": "pa11y-ci",
    "test:a11y:watch": "node scripts/accessibility/watch.js",
    "test:a11y:components": "jest --testPathPattern=accessibility"
  }
}
```

### 4. Run Your First Test

```bash
# Start your development server
docker compose exec scripthammer pnpm run dev

# In another terminal, run accessibility test
docker compose exec scripthammer pnpm run test:a11y
```

## Development Workflow

### Daily Development with Accessibility

#### Option 1: Real-time File Watcher

Create `scripts/accessibility/watch.js`:

```javascript
const pa11y = require('pa11y');
const chalk = require('chalk');
const chokidar = require('chokidar');

const url = 'http://localhost:3000/CRUDkit';

async function checkAccessibility() {
  console.clear();
  console.log(chalk.cyan('🔍 Running accessibility check...\n'));

  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      runners: ['axe'],
    });

    if (results.issues.length === 0) {
      console.log(chalk.green('✅ No accessibility issues found!'));
    } else {
      console.log(chalk.yellow(`⚠️  Found ${results.issues.length} issues:\n`));

      results.issues.slice(0, 5).forEach((issue) => {
        const icon = issue.type === 'error' ? '❌' : '⚠️';
        console.log(`${icon} ${issue.message}`);
        console.log(`   ${chalk.gray(issue.selector)}\n`);
      });
    }
  } catch (error) {
    console.error(chalk.red('❌ Test failed:', error.message));
  }
}

// Initial check
checkAccessibility();

// Watch for file changes
chokidar.watch('src/**/*.{tsx,ts,css}').on('change', () => {
  console.log(chalk.gray('\n📝 File changed, re-running...\n'));
  setTimeout(checkAccessibility, 1000);
});
```

Run the watcher:

```bash
docker compose exec scripthammer pnpm run test:a11y:watch
```

#### Option 2: Development Runtime Integration

Add to your `app/layout.tsx`:

```typescript
'use client';

import { useEffect } from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('@axe-core/react').then(({ default: axe }) => {
        axe(React, ReactDOM, 1000, {
          rules: {
            'color-contrast': { enabled: true },
            'label': { enabled: true },
          },
        });
      });
    }
  }, []);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### Component Testing Setup

Create `src/utils/accessibility/testing.ts`:

```typescript
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import { ReactElement } from 'react';

expect.extend(toHaveNoViolations);

const axe = configureAxe({
  rules: {
    region: { enabled: false }, // Disable for component tests
    'color-contrast': { enabled: true },
  },
});

export async function testAccessibility(component: ReactElement) {
  const { container } = render(component);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}
```

Add to your component tests:

```typescript
// src/components/subatomic/Button/Button.test.tsx
import { testAccessibility } from '@/utils/accessibility/testing';
import Button from './Button';

describe('Button Accessibility', () => {
  it('should be accessible', async () => {
    await testAccessibility(<Button>Click me</Button>);
  });

  it('should be accessible when disabled', async () => {
    await testAccessibility(<Button disabled>Disabled</Button>);
  });
});
```

## Common Commands

### Development Commands

```bash
# Run single accessibility check
docker compose exec scripthammer pnpm run test:a11y

# Watch for changes and re-run tests
docker compose exec scripthammer pnpm run test:a11y:watch

# Run component accessibility tests
docker compose exec scripthammer pnpm run test:a11y:components

# Generate HTML report
docker compose exec scripthammer pa11y-ci --reporter html

# Test specific URL
docker compose exec scripthammer pa11y http://localhost:3000/CRUDkit/themes --standard WCAG2AA
```

### CI/CD Commands

```bash
# Full accessibility test suite
pnpm run test:a11y

# Generate JSON report for dashboard
pa11y-ci --reporter json

# Test with strict mode (zero tolerance)
pa11y-ci --threshold 0
```

## IDE Integration

### VS Code Setup

Install recommended extensions:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "deque-systems.vscode-axe-linter",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

Add settings:

```json
// .vscode/settings.json
{
  "axe-linter.enable": true,
  "axe-linter.enableAutoTest": true
}
```

### Code Snippets

Add to `.vscode/snippets/accessibility.code-snippets`:

```json
{
  "Accessibility Test": {
    "prefix": "a11ytest",
    "body": [
      "it('should be accessible', async () => {",
      "  await testAccessibility(<${1:Component} />);",
      "});"
    ]
  },
  "Accessibility Test with States": {
    "prefix": "a11ystates",
    "body": [
      "it('should be accessible in all states', async () => {",
      "  const states = {",
      "    default: {},",
      "    disabled: { disabled: true }",
      "  };",
      "",
      "  for (const [name, props] of Object.entries(states)) {",
      "    await testAccessibility(<${1:Component} {...props} />);",
      "  }",
      "});"
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### 1. "Chrome failed to start" Error

```bash
# Add to .pa11yci/config.json
{
  "defaults": {
    "chromeLaunchConfig": {
      "args": [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    }
  }
}
```

#### 2. "Color contrast" Violations

```javascript
// Temporarily ignore while fixing themes
{
  "ignore": ["color-contrast;.theme-controller"]
}
```

#### 3. "Port 3000 not available" Error

```bash
# Make sure your dev server is running
docker compose exec scripthammer pnpm run dev

# Or update URLs in config to match your server
```

#### 4. Component Tests Failing

```typescript
// Make sure to render with proper context
await testAccessibility(
  <ThemeProvider>
    <Component />
  </ThemeProvider>
);
```

### Getting Help

1. **Check the logs**: Pa11y provides detailed error messages
2. **Use browser DevTools**: Inspect elements that are failing
3. **Consult WCAG guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
4. **Test with screen readers**: Use NVDA (free) for additional validation

## Next Steps

Once you have the basic setup working:

1. **Configure CI/CD**: Add accessibility tests to your GitHub Actions
2. **Set up dashboard**: Create the accessibility dashboard page
3. **Fix violations**: Work through any existing accessibility issues
4. **Team training**: Share accessibility knowledge with your team
5. **Regular audits**: Schedule monthly accessibility reviews

## Configuration Examples

### For Different Environments

#### Development (Fast feedback)

```json
{
  "defaults": {
    "timeout": 5000,
    "threshold": 5,
    "includeWarnings": false
  }
}
```

#### CI/CD (Strict validation)

```json
{
  "defaults": {
    "timeout": 15000,
    "threshold": 0,
    "includeWarnings": true
  }
}
```

#### Production Audit (Comprehensive)

```json
{
  "defaults": {
    "timeout": 20000,
    "threshold": 0,
    "includeNotices": true,
    "includeWarnings": true
  }
}
```

### Multi-Theme Testing

```json
{
  "urls": [
    {
      "url": "http://localhost:3000/CRUDkit",
      "label": "Light Theme",
      "actions": ["click element [data-theme='light']"]
    },
    {
      "url": "http://localhost:3000/CRUDkit",
      "label": "Dark Theme",
      "actions": ["click element [data-theme='dark']"]
    }
  ]
}
```

## Performance Tips

1. **Run tests in parallel**: Use Pa11y's concurrency options
2. **Cache results**: Avoid re-testing unchanged pages
3. **Use selective testing**: Test only modified routes in development
4. **Optimize browser args**: Use minimal Chrome configuration

## Success Metrics

Track these metrics to measure accessibility improvement:

- **Zero critical violations** in CI
- **90%+ pages WCAG AA compliant**
- **All components tested** for accessibility
- **Sub-30 second** CI accessibility test runtime

You're now ready to start building accessible components and pages! The system will automatically catch accessibility issues as you develop.
