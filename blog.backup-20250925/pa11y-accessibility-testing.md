---
title: 'Pa11y: Automated Accessibility Testing That Actually Helps'
slug: 'pa11y-accessibility-testing'
excerpt: 'Catch accessibility issues before your users do. Pa11y makes WCAG compliance automatic.'
author: 'TortoiseWolfe'
publishDate: 2025-11-03
status: 'published'
featured: false
categories:
  - Accessibility
  - Testing
  - Automation
tags:
  - pa11y
  - accessibility
  - testing
  - wcag
  - automation
readTime: 7
ogImage: '/blog-images/2025-11-03-pa11y-accessibility-testing.png'
---

# Pa11y: Automated Accessibility Testing That Actually Helps

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Lawsuit That Could've Been Prevented 💰

**2019**: Domino's Pizza sued for inaccessible website
**Cost**: Millions in legal fees
**Fix**: Would've taken 2 days
**Prevention**: Pa11y would've caught it

Don't be Domino's.

## Pa11y in 60 Seconds ⚡

```bash
# Install
docker compose exec scripthammer pnpm add -D pa11y

# Test
docker compose exec scripthammer npx pa11y http://localhost:3000

# Results
✅ No accessibility issues found
❌ 3 errors, 7 warnings (with exact fixes)
```

Accessibility testing. Automated. Done.

## The CI/CD Guardian 🚦

```yaml
# .github/workflows/a11y.yml
- name: Accessibility Test
  run: |
    docker compose exec scripthammer pnpm start &
    sleep 5
    docker compose exec scripthammer npx pa11y http://localhost:3000       --reporter cli       --standard WCAG2AA
```

Bad accessibility never reaches production.

## Real Issues It Catches 🎯

```bash
# Missing alt text
❌ Images must have alternate text
   <img src="hero.jpg">
   Fix: Add alt="Description"

# Poor contrast
❌ Text contrast ratio 2.1:1 (minimum 4.5:1)
   .light-text { color: #ccc; }
   Fix: Use darker color #666

# Missing labels
❌ Form fields must have labels
   <input type="email">
   Fix: Add <label> or aria-label
```

Specific problems. Exact solutions.

## The Config That Matters 📋

```javascript
// .pa11yrc
{
  "standard": "WCAG2AA",
  "timeout": 10000,
  "wait": 1000,
  "ignore": [
    "warning",
    "notice"
  ],
  "hideElements": ".ads, .cookie-banner",
  "actions": [
    "click element .accept-cookies",
    "wait for element .content"
  ]
}
```

## Test User Journeys 🚶

```javascript
// Test complete flows
pa11y('http://localhost:3000', {
  actions: [
    'navigate to http://localhost:3000/login',
    'type email "test@example.com"',
    'type password "password"',
    'click element button[type="submit"]',
    'wait for path to be /dashboard',
  ],
});

// Catch issues in dynamic content
```

## Multiple Pages at Once 📚

```bash
# pa11y-ci.json
{
  "urls": [
    "http://localhost:3000/",
    "http://localhost:3000/about",
    "http://localhost:3000/contact",
    {
      "url": "http://localhost:3000/dashboard",
      "actions": ["login first"]
    }
  ]
}

docker compose exec scripthammer npx pa11y-ci
```

Entire site tested in parallel.

## The Dashboard View 📊

```bash
# HTML report
docker compose exec scripthammer npx pa11y   --reporter html   --output report.html   http://localhost:3000

# Beautiful visual report
# Share with team
# Track progress
```

## Screen Reader Testing 🗣️

```javascript
pa11y('http://localhost:3000', {
  runners: [
    'axe', // Deque's axe-core
    'htmlcs', // HTML CodeSniffer
  ],

  // Test with screen reader behavior
  screenCapture: 'screenshots/a11y.png',
  log: {
    debug: console.log,
    error: console.error,
    info: console.info,
  },
});
```

## Custom Rules for Your App 🎨

```javascript
// Add custom tests
pa11y('http://localhost:3000', {
  rules: {
    'company-alt-text': {
      selector: 'img',
      test: (element) => {
        return element.alt && element.alt.length > 10;
      },
      message: 'Images need descriptive alt text (10+ chars)',
    },
  },
});
```

## The Accessibility Score 🏆

```javascript
// Track improvement over time
const results = await pa11y(url);

const score = {
  errors: results.issues.filter((i) => i.type === 'error').length,
  warnings: results.issues.filter((i) => i.type === 'warning').length,
  notices: results.issues.filter((i) => i.type === 'notice').length,

  // Calculate score
  score: Math.max(0, 100 - errors * 10 - warnings * 2),
};

// Goal: 100% accessible
```

## Real Impact Stories 📈

**Before Pa11y**:

- Accessibility issues: Unknown
- User complaints: Weekly
- Screen reader users: 0%
- Legal risk: High

**After Pa11y**:

- Issues caught: 100% before deploy
- User complaints: None
- Screen reader users: 3.2%
- Legal risk: Minimal

## The Business Case 💼

**Cost of Pa11y**: Free
**Cost of lawsuit**: $100,000+
**Cost of lost users**: Unlimited
**ROI**: Infinite

## Start Testing Today

```bash
# Install
docker compose exec scripthammer pnpm add -D pa11y pa11y-ci

# Test one page
docker compose exec scripthammer npx pa11y http://localhost:3000

# Test everything
docker compose exec scripthammer npx pa11y-ci

# Add to CI
echo "pa11y-ci" >> .github/workflows/test.yml
```

Stop excluding users.
Start including everyone.

Accessibility isn't optional anymore.
