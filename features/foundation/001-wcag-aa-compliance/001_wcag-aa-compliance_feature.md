# Product Requirements Prompt (PRP)

**Feature Name**: WCAG AA Compliance Automation
**Priority**: P0 (Constitutional Requirement)
**Sprint**: Sprint 3
**Status**: Inbox
**Created**: 2025-09-13
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

An automated WCAG AA compliance system that runs accessibility tests in CI/CD, provides real-time feedback during development, and ensures all components meet accessibility standards. This includes Pa11y CI integration, axe-core testing, and automated remediation suggestions.

### Why We're Building It

- Constitutional requirement (Section 2: Accessibility - WCAG AA)
- Currently marked as "Basic controls, WCAG" in constitution
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
│   ├── audit.js          # Run full audit
│   ├── watch.js          # Dev mode watcher
│   ├── report.js         # Generate reports
│   └── post-results.js   # Post to Edge Function (CI)

supabase/
├── functions/
│   └── accessibility-scores/
│       └── index.ts      # Edge Function for score storage
└── migrations/
    └── 001_accessibility_scores.sql  # Scores table

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
      "url": "http://localhost:3000/",
      "label": "Homepage"
    },
    {
      "url": "http://localhost:3000/themes",
      "label": "Theme Switcher",
      "actions": ["wait for element .theme-controller to be visible"]
    },
    {
      "url": "http://localhost:3000/components",
      "label": "Component Gallery"
    },
    {
      "url": "http://localhost:3000/accessibility",
      "label": "Accessibility Controls"
    },
    {
      "url": "http://localhost:3000/status",
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
  'http://localhost:3000/',
  'http://localhost:3000/themes',
  'http://localhost:3000/components',
];

async function checkAccessibility(url) {
  try {
    const results = await pa11y(url, {
      standard: 'WCAG2AA',
      runners: ['htmlcs', 'axe'],
    });

    if (results.issues.length === 0) {
      console.log(chalk.green(`${url} - No accessibility issues`));
    } else {
      console.log(
        chalk.yellow(`${url} - ${results.issues.length} issues found`)
      );

      results.issues.forEach((issue) => {
        const icon = issue.type === 'error' ? 'X' : '!';
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
  console.log(chalk.cyan('Running accessibility checks...\n'));

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
  console.log(chalk.gray('\nFile changed, re-running checks...\n'));
  runChecks();
});

console.log(chalk.blue('Watching for changes...\n'));
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

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

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
        run: pnpm run test:a11y -- --json > pa11y-results.json

      - name: Post results to Supabase Edge Function
        if: github.ref == 'refs/heads/main'
        run: |
          # Transform Pa11y JSON to score format and post to Edge Function
          node scripts/accessibility/post-results.js

      - name: Upload results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-report
          path: pa11y-results/
```

### CI Results Posting Script

```javascript
// scripts/accessibility/post-results.js
// Transforms Pa11y JSON output and posts to Supabase Edge Function
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function postResults() {
  const results = JSON.parse(fs.readFileSync('pa11y-results.json', 'utf8'));

  // Transform to score format
  const scores = results.map((result) => ({
    page: result.pageUrl.replace('http://localhost:3000', ''),
    score: calculateScore(result),
    issues: {
      error: result.issues.filter((i) => i.type === 'error').length,
      warning: result.issues.filter((i) => i.type === 'warning').length,
      notice: result.issues.filter((i) => i.type === 'notice').length,
    },
  }));

  // Post to Edge Function
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/accessibility-scores`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(scores),
    }
  );

  if (!response.ok) {
    console.error('Failed to post results:', await response.text());
    process.exit(1);
  }

  console.log('Accessibility scores posted successfully');
}

function calculateScore(result) {
  const errors = result.issues.filter((i) => i.type === 'error').length;
  const warnings = result.issues.filter((i) => i.type === 'warning').length;
  // Score: 100 - (errors * 10) - (warnings * 2), min 0
  return Math.max(0, 100 - errors * 10 - warnings * 2);
}

postResults();
```

### Supabase Edge Function for Score Storage

```typescript
// supabase/functions/accessibility-scores/index.ts
// Called by CI pipeline to store Pa11y results
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Only allow POST from CI (authenticated via service role)
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const scores = await req.json();

  // Upsert scores (replace existing for same page)
  const { error } = await supabase.from('accessibility_scores').upsert(
    scores.map((s: any) => ({
      page: s.page,
      score: s.score,
      issues_error: s.issues.error,
      issues_warning: s.issues.warning,
      issues_notice: s.issues.notice,
      last_checked: new Date().toISOString(),
    })),
    { onConflict: 'page' }
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

### Database Migration

```sql
-- supabase/migrations/001_accessibility_scores.sql
CREATE TABLE IF NOT EXISTS accessibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT UNIQUE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  issues_error INTEGER NOT NULL DEFAULT 0,
  issues_warning INTEGER NOT NULL DEFAULT 0,
  issues_notice INTEGER NOT NULL DEFAULT 0,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Anyone can read scores (public dashboard)
ALTER TABLE accessibility_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
ON accessibility_scores FOR SELECT
USING (true);

-- Only service role can write (from CI Edge Function)
CREATE POLICY "Service role write access"
ON accessibility_scores FOR INSERT
USING (auth.role() = 'service_role');

CREATE POLICY "Service role update access"
ON accessibility_scores FOR UPDATE
USING (auth.role() = 'service_role');
```

### Accessibility Dashboard

```typescript
// app/accessibility/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

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
  const supabase = createClient();

  useEffect(() => {
    // Load scores from Supabase (static-export compliant)
    async function loadScores() {
      const { data, error } = await supabase
        .from('accessibility_scores')
        .select('*')
        .order('page');

      if (data && !error) {
        setScores(data.map(row => ({
          page: row.page,
          score: row.score,
          issues: {
            error: row.issues_error,
            warning: row.issues_warning,
            notice: row.issues_notice,
          },
          lastChecked: row.last_checked,
        })));
      }
    }

    loadScores();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('accessibility_scores_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'accessibility_scores',
      }, () => loadScores())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

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

- Constitution: `.specify/memory/constitution.md` (Section 2: Accessibility)
- Accessibility Context: `/src/contexts/AccessibilityContext.tsx`
- Testing Guide: `/TESTING.md`

### External Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Pa11y Documentation](https://pa11y.org/)
- [Axe-core Documentation](https://www.deque.com/axe/)
- [WebAIM Resources](https://webaim.org/)

---

## PRP Workflow Status

### Review Checklist (Inbox to Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox to Processed)

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
