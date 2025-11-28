# Product Requirements Prompt (PRP)

**Feature Name**: WCAG AA Compliance Automation  
**Priority**: P0 (Constitutional Requirement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

An automated WCAG AA compliance system that runs accessibility tests in CI/CD, provides real-time feedback during development, and ensures all components meet accessibility standards. This includes Pa11y CI integration, axe-core testing, and automated remediation suggestions.

### Why We're Building It

- Constitutional requirement (Section 2: Accessibility - WCAG AA)
- Currently marked as "⚠️ Basic controls, ❌ WCAG" in constitution
- Legal compliance requirement
- Ensures inclusive user experience
- Prevents accessibility regressions

### Success Criteria

- [ ] Pa11y CI integrated and enforcing in CI/CD
- [ ] All pages pass WCAG AA standards
- [ ] Axe-core integrated in component tests
- [ ] Real-time accessibility feedback in dev
- [ ] Automated issue reporting
- [ ] Remediation guidance provided
- [ ] Accessibility score dashboard
- [ ] Zero critical violations

### Out of Scope

- WCAG AAA compliance (AA is target)
- Manual accessibility audits
- Screen reader testing automation
- Voice control testing
- Custom accessibility tools development

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Pa11y Already Installed

```json
// package.json
"devDependencies": {
  "pa11y": "^8.0.0"
}
```

#### Accessibility Context

```typescript
// src/contexts/AccessibilityContext.tsx
// Already handles fontSize and spacing controls
export const AccessibilityContext = createContext({
  fontSize: 'base',
  spacing: 'normal',
  setFontSize: () => {},
  setSpacing: () => {},
});
```

#### Storybook A11y Addon

```javascript
// .storybook/main.ts
addons: [
  '@storybook/addon-a11y', // Already configured
];
```

### Dependencies & Libraries

```bash
# Already installed
# pa11y

# Need to add
pnpm add -D pa11y-ci axe-core @axe-core/react jest-axe
```

### File Structure

```
.pa11yci/
├── config.json           # Pa11y CI configuration
├── custom-rules.js       # Custom accessibility rules
└── ignore-list.json      # Known issues to ignore

scripts/
├── accessibility/
│   ├── audit.js         # Run full audit
│   ├── watch.js         # Dev mode watcher
│   └── report.js        # Generate reports

src/
├── utils/
│   └── accessibility/
│       ├── axe-setup.ts
│       └── testing.ts
└── components/
    └── __tests__/
        └── accessibility.test.tsx
```

---

## 3. Technical Specifications

### Pa11y CI Configuration

```json
// .pa11yci/config.json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 10000,
    "wait": 500,
    "viewport": {
      "width": 1280,
      "height": 720
    },
    "chromeLaunchConfig": {
      "args": ["--no-sandbox", "--disable-setuid-sandbox"]
    },
    "actions": [],
    "hideElements": ".loading",
    "ignore": [
      "color-contrast" // Temporarily while fixing themes
    ]
  },
  "urls": [
    {
      "url": "http://localhost:3000/CRUDkit",
      "label": "Homepage"
    },
    {
      "url": "http://localhost:3000/CRUDkit/themes",
      "label": "Theme Switcher",
      "actions": ["wait for element .theme-controller to be visible"]
    },
    {
      "url": "http://localhost:3000/CRUDkit/components",
      "label": "Component Gallery"
    },
    {
      "url": "http://localhost:3000/CRUDkit/accessibility",
      "label": "Accessibility Controls"
    },
    {
      "url": "http://localhost:3000/CRUDkit/status",
      "label": "Status Dashboard"
    }
  ],
  "reporters": ["cli", "json", "html"]
}
```

### Axe-Core Integration

```typescript
// src/utils/accessibility/axe-setup.ts
import React from 'react';

export function setupAxe() {
  if (process.env.NODE_ENV !== 'production') {
    import('@axe-core/react').then(({ default: axe }) => {
      axe(React, ReactDOM, 1000, {
        rules: {
          'color-contrast': { enabled: true },
          label: { enabled: true },
          'aria-roles': { enabled: true },
        },
      });
    });
  }
}

// app/layout.tsx
import { setupAxe } from '@/utils/accessibility/axe-setup';

useEffect(() => {
  setupAxe();
}, []);
```

### Component Testing Helper

```typescript
// src/utils/accessibility/testing.ts
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Configure axe
const axe = configureAxe({
  rules: {
    region: { enabled: false }, // Disable for component tests
    'color-contrast': { enabled: true },
  },
});

export async function testAccessibility(component: React.ReactElement) {
  const { container } = render(component);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
  return results;
}
```

### Component Accessibility Tests

```typescript
// src/components/__tests__/accessibility.test.tsx
import { testAccessibility } from '@/utils/accessibility/testing';
import Button from '@/components/subatomic/Button';
import Card from '@/components/atomic/Card';
import Form from '@/components/atomic/Form';
import Modal from '@/components/atomic/Modal';

describe('Component Accessibility', () => {
  it('Button is accessible', async () => {
    await testAccessibility(<Button>Click me</Button>);
  });

  it('Card is accessible', async () => {
    await testAccessibility(
      <Card title="Test Card">Content</Card>
    );
  });

  it('Form is accessible', async () => {
    await testAccessibility(
      <Form>
        <label htmlFor="test">Test Input</label>
        <input id="test" type="text" />
      </Form>
    );
  });

  it('Modal is accessible', async () => {
    await testAccessibility(
      <Modal isOpen={true} onClose={() => {}}>
        Modal Content
      </Modal>
    );
  });
});
```

### Real-time Development Watcher

```javascript
// scripts/accessibility/watch.js
const pa11y = require('pa11y');
const chalk = require('chalk');
const chokidar = require('chokidar');

const urls = [
  'http://localhost:3000/CRUDkit',
  'http://localhost:3000/CRUDkit/themes',
  'http://localhost:3000/CRUDkit/components',
];

async function checkAccessibility(url) {
  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      runners: ['htmlcs', 'axe'],
    });

    if (results.issues.length === 0) {
      console.log(chalk.green(`✅ ${url} - No accessibility issues`));
    } else {
      console.log(
        chalk.yellow(`⚠️  ${url} - ${results.issues.length} issues found`)
      );

      results.issues.forEach((issue) => {
        const icon = issue.type === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} ${issue.message}`);
        console.log(`     ${chalk.gray(issue.selector)}`);
        console.log(`     ${chalk.blue(issue.code)}`);
      });
    }
  } catch (error) {
    console.error(chalk.red(`Failed to test ${url}:`, error.message));
  }
}

async function runChecks() {
  console.clear();
  console.log(chalk.cyan('🔍 Running accessibility checks...\n'));

  for (const url of urls) {
    await checkAccessibility(url);
    console.log('');
  }
}

// Initial check
runChecks();

// Watch for changes
const watcher = chokidar.watch('src/**/*.{tsx,ts,css}', {
  ignored: /node_modules/,
  persistent: true,
});

watcher.on('change', () => {
  console.log(chalk.gray('\n📝 File changed, re-running checks...\n'));
  runChecks();
});

console.log(chalk.blue('👀 Watching for changes...\n'));
```

### GitHub Actions Integration

```yaml
# .github/workflows/accessibility.yml
name: Accessibility Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  a11y:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        run: corepack enable

      - name: Install dependencies
        run: pnpm install

      - name: Build application
        run: pnpm run build

      - name: Start server
        run: |
          pnpm run start &
          sleep 5

      - name: Run Pa11y CI
        run: pnpm run test:a11y

      - name: Upload results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-report
          path: pa11y-results/
```

### Accessibility Dashboard

```typescript
// app/accessibility/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface AccessibilityScore {
  page: string;
  score: number;
  issues: {
    error: number;
    warning: number;
    notice: number;
  };
  lastChecked: string;
}

export default function AccessibilityDashboard() {
  const [scores, setScores] = useState<AccessibilityScore[]>([]);

  useEffect(() => {
    // Load latest Pa11y results
    fetch('/api/accessibility/scores')
      .then(res => res.json())
      .then(setScores);
  }, []);

  const overallScore = scores.reduce((acc, s) => acc + s.score, 0) / scores.length || 0;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Accessibility Dashboard</h1>

      <div className="stats shadow mb-6">
        <div className="stat">
          <div className="stat-title">Overall Score</div>
          <div className="stat-value">{Math.round(overallScore)}%</div>
          <div className="stat-desc">WCAG AA Compliance</div>
        </div>

        <div className="stat">
          <div className="stat-title">Total Issues</div>
          <div className="stat-value text-error">
            {scores.reduce((acc, s) => acc + s.issues.error, 0)}
          </div>
          <div className="stat-desc">Errors to fix</div>
        </div>

        <div className="stat">
          <div className="stat-title">Warnings</div>
          <div className="stat-value text-warning">
            {scores.reduce((acc, s) => acc + s.issues.warning, 0)}
          </div>
          <div className="stat-desc">Should review</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Score</th>
              <th>Errors</th>
              <th>Warnings</th>
              <th>Last Checked</th>
            </tr>
          </thead>
          <tbody>
            {scores.map(score => (
              <tr key={score.page}>
                <td>{score.page}</td>
                <td>
                  <progress
                    className="progress progress-success"
                    value={score.score}
                    max="100"
                  />
                </td>
                <td className="text-error">{score.issues.error}</td>
                <td className="text-warning">{score.issues.warning}</td>
                <td>{new Date(score.lastChecked).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 4. Implementation Runbook

### Step 1: Install Dependencies

```bash
pnpm add -D pa11y-ci axe-core @axe-core/react jest-axe chokidar chalk
```

### Step 2: Configure Pa11y CI

```bash
mkdir -p .pa11yci
touch .pa11yci/config.json
# Add configuration from Technical Specs
```

### Step 3: Create Scripts

```bash
mkdir -p scripts/accessibility
touch scripts/accessibility/audit.js
touch scripts/accessibility/watch.js
touch scripts/accessibility/report.js
```

### Step 4: Update package.json

```json
{
  "scripts": {
    "test:a11y": "pa11y-ci",
    "test:a11y:watch": "node scripts/accessibility/watch.js",
    "test:a11y:report": "node scripts/accessibility/report.js"
  }
}
```

### Step 5: Add to CI Pipeline

```bash
# Update .github/workflows/ci.yml
# Add accessibility job
```

### Step 6: Fix Violations

- Run initial audit
- Fix critical errors first
- Address warnings
- Document any ignored rules

---

## 5. Validation Loops

### Pre-Implementation Checks

- [x] Pa11y installed
- [x] Storybook a11y addon configured
- [ ] Baseline audit completed
- [ ] Team trained on WCAG AA

### During Implementation

- [ ] CI tests passing
- [ ] Dev watcher working
- [ ] Component tests added
- [ ] Dashboard displaying data

### Post-Implementation

- [ ] All pages WCAG AA compliant
- [ ] Zero critical violations
- [ ] CI enforcing standards
- [ ] Documentation complete

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Too many existing violations
   **Mitigation**: Phased approach, fix critical first

2. **Risk**: False positives blocking CI
   **Mitigation**: Configurable ignore list

3. **Risk**: Performance impact from axe-core
   **Mitigation**: Dev/test only, not production

4. **Risk**: Theme contrast issues
   **Mitigation**: Test all 32 themes systematically

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 2: Accessibility)
- Accessibility Context: `/src/contexts/AccessibilityContext.tsx`
- Testing Guide: `/TESTING.md`

### External Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Pa11y Documentation](https://pa11y.org/)
- [Axe-core Documentation](https://www.deque.com/axe/)
- [WebAIM Resources](https://webaim.org/)

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
PRP for WCAG AA Compliance Automation
Generated from SpecKit constitution analysis
Ensures accessibility standards are met and maintained
-->
