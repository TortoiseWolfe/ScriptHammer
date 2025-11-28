# Pa11y CI Configuration Contract

## Overview

This document defines the configuration contract for Pa11y CI integration in the WCAG AA compliance system. It specifies the exact configuration format, rules, and behavior expected from the Pa11y testing tool.

## Configuration File Structure

### Primary Configuration: `.pa11yci/config.json`

```json
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
      "args": [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
      "headless": true
    },
    "runners": ["htmlcs", "axe"],
    "actions": [],
    "hideElements": ".loading, .skeleton, [data-testid='loading']",
    "includeNotices": false,
    "includeWarnings": true,
    "threshold": 0,
    "ignore": ["color-contrast;.theme-controller", "region;main"],
    "rootElement": "body",
    "rules": []
  },
  "urls": [
    {
      "url": "http://localhost:3000/CRUDkit",
      "label": "Homepage",
      "actions": ["wait for element .hero to be visible"]
    },
    {
      "url": "http://localhost:3000/CRUDkit/themes",
      "label": "Theme Switcher",
      "actions": [
        "wait for element .theme-controller to be visible",
        "click element .theme-controller[data-theme='dark']",
        "wait for 1000"
      ],
      "viewport": {
        "width": 1280,
        "height": 720
      }
    },
    {
      "url": "http://localhost:3000/CRUDkit/components",
      "label": "Component Gallery",
      "actions": ["wait for element .component-showcase to be visible"]
    },
    {
      "url": "http://localhost:3000/CRUDkit/accessibility",
      "label": "Accessibility Controls",
      "actions": [
        "wait for element .accessibility-controls to be visible",
        "click element [data-testid='font-size-large']",
        "wait for 500"
      ]
    },
    {
      "url": "http://localhost:3000/CRUDkit/status",
      "label": "Status Dashboard",
      "hideElements": ".chart-loading, .metric-skeleton"
    }
  ],
  "reporters": [
    {
      "name": "cli"
    },
    {
      "name": "json",
      "options": {
        "fileName": "pa11y-results.json"
      }
    },
    {
      "name": "html",
      "options": {
        "fileName": "pa11y-report.html"
      }
    }
  ]
}
```

## Configuration Options Reference

### Global Defaults

| Option            | Type    | Description                              | Default     |
| ----------------- | ------- | ---------------------------------------- | ----------- |
| `standard`        | string  | WCAG standard to test against            | `"WCAG2AA"` |
| `timeout`         | number  | Maximum time to wait for page load (ms)  | `10000`     |
| `wait`            | number  | Time to wait before running tests (ms)   | `500`       |
| `threshold`       | number  | Number of errors to allow before failing | `0`         |
| `includeNotices`  | boolean | Include notice-level issues              | `false`     |
| `includeWarnings` | boolean | Include warning-level issues             | `true`      |
| `rootElement`     | string  | CSS selector for root element to test    | `"body"`    |

### Viewport Configuration

```typescript
interface Viewport {
  width: number; // Viewport width in pixels
  height: number; // Viewport height in pixels
}
```

**Standard Viewports:**

- **Desktop**: 1280x720 (default)
- **Tablet**: 768x1024
- **Mobile**: 375x667

### Chrome Launch Configuration

```typescript
interface ChromeLaunchConfig {
  args: string[]; // Chrome command-line arguments
  headless: boolean; // Run in headless mode
  devtools?: boolean; // Open DevTools
  ignoreHTTPSErrors?: boolean; // Ignore HTTPS certificate errors
}
```

**Required Arguments for CI:**

```json
{
  "args": [
    "--no-sandbox", // Required for Docker/CI
    "--disable-setuid-sandbox", // Required for Docker/CI
    "--disable-dev-shm-usage", // Prevents memory issues
    "--disable-gpu" // Prevents GPU-related crashes
  ]
}
```

### Testing Runners

| Runner   | Description      | Strengths                               |
| -------- | ---------------- | --------------------------------------- |
| `htmlcs` | HTML_CodeSniffer | Fast, lightweight, good coverage        |
| `axe`    | Axe-core         | Most comprehensive, actively maintained |

**Recommended Configuration:**

```json
{
  "runners": ["htmlcs", "axe"]
}
```

### Actions Configuration

Actions allow interaction with pages before testing.

```typescript
interface TestAction {
  action: string; // Action type
  selector?: string; // CSS selector for target element
  value?: string; // Value for input actions
  timeout?: number; // Action-specific timeout
}
```

#### Available Actions

##### Wait Actions

```json
"wait for element .selector to be visible"
"wait for element .selector to be hidden"
"wait for element .selector to be added"
"wait for element .selector to be removed"
"wait for 1000"  // Wait for specific time in ms
```

##### Click Actions

```json
"click element .button"
"click element #submit-btn"
```

##### Form Actions

```json
"set field #input-id to value"
"check field #checkbox-id"
"uncheck field #checkbox-id"
"select option value from #select-id"
```

##### Navigation Actions

```json
"navigate to /new-path"
"reload"
"go back"
```

### Ignore Rules Configuration

Ignore specific accessibility issues using various patterns:

#### Global Rule Ignoring

```json
{
  "ignore": [
    "color-contrast", // Ignore all color contrast issues
    "region", // Ignore all region issues
    "duplicate-id" // Ignore duplicate ID issues
  ]
}
```

#### Element-Specific Ignoring

```json
{
  "ignore": [
    "color-contrast;.theme-selector", // Ignore contrast on theme selector
    "region;main", // Ignore region rule on main element
    "label;input[type='range']" // Ignore label rule on range inputs
  ]
}
```

#### XPath-Based Ignoring

```json
{
  "ignore": [
    "color-contrast;//button[@data-theme]", // XPath selector
    "label;//*[@id='theme-switcher']//input" // Complex XPath
  ]
}
```

### URL Configuration

Each URL can have specific overrides:

```typescript
interface UrlConfig {
  url: string; // URL to test
  label: string; // Human-readable name
  actions?: string[]; // Page-specific actions
  timeout?: number; // Page-specific timeout
  wait?: number; // Page-specific wait time
  hideElements?: string; // Page-specific elements to hide
  viewport?: Viewport; // Page-specific viewport
  ignore?: string[]; // Page-specific ignore rules
  standard?: string; // Page-specific WCAG standard
  threshold?: number; // Page-specific error threshold
}
```

### Reporter Configuration

#### CLI Reporter

```json
{
  "name": "cli",
  "options": {
    "includeNotices": false,
    "includeWarnings": true
  }
}
```

#### JSON Reporter

```json
{
  "name": "json",
  "options": {
    "fileName": "pa11y-results.json"
  }
}
```

#### HTML Reporter

```json
{
  "name": "html",
  "options": {
    "fileName": "pa11y-report.html"
  }
}
```

## Environment-Specific Configurations

### Development Configuration

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 5000,
    "wait": 200,
    "threshold": 5,
    "includeWarnings": true,
    "ignore": ["color-contrast;.theme-controller", "region;main"]
  },
  "urls": [
    {
      "url": "http://localhost:3000/CRUDkit",
      "label": "Development Homepage"
    }
  ],
  "reporters": ["cli"]
}
```

### CI/CD Configuration

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 15000,
    "wait": 1000,
    "threshold": 0,
    "includeWarnings": true,
    "chromeLaunchConfig": {
      "args": [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--remote-debugging-port=9222"
      ],
      "headless": true
    }
  },
  "reporters": ["cli", "json", "html"]
}
```

### Production Audit Configuration

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 20000,
    "wait": 2000,
    "threshold": 0,
    "includeWarnings": true,
    "includeNotices": false
  },
  "urls": [
    {
      "url": "https://yourdomain.com/CRUDkit",
      "label": "Production Homepage"
    }
  ]
}
```

## Custom Rules Configuration

### File: `.pa11yci/custom-rules.js`

```javascript
module.exports = {
  // Custom rule for theme accessibility
  'custom-theme-contrast': {
    evaluate: function (node, options) {
      const themeAttribute = node.getAttribute('data-theme');
      if (themeAttribute) {
        const computedStyle = window.getComputedStyle(node);
        const backgroundColor = computedStyle.backgroundColor;
        const color = computedStyle.color;

        // Custom contrast checking logic
        const contrast = calculateContrast(backgroundColor, color);
        return contrast >= 4.5; // WCAG AA requirement
      }
      return true;
    },
    options: {},
    matches: function (node, virtualNode) {
      return node.hasAttribute('data-theme');
    },
    impact: 'serious',
    tags: ['wcag2aa', 'wcag143', 'custom'],
  },
};
```

## Ignore List Management

### File: `.pa11yci/ignore-list.json`

```json
{
  "rules": [
    {
      "id": "ignore-001",
      "ruleCode": "color-contrast",
      "scope": "global",
      "selector": ".theme-controller",
      "reason": "Theme controller colors are dynamically generated",
      "category": "design_decision",
      "createdAt": "2025-09-14T00:00:00Z",
      "expiresAt": "2025-12-14T00:00:00Z"
    },
    {
      "id": "ignore-002",
      "ruleCode": "region",
      "scope": "page",
      "target": "/CRUDkit/themes",
      "reason": "Page structure uses DaisyUI layout patterns",
      "category": "technical_debt",
      "createdAt": "2025-09-14T00:00:00Z"
    }
  ],
  "version": "1.0.0",
  "lastUpdated": "2025-09-14T00:00:00Z"
}
```

## Theme-Specific Testing

### Configuration for Multi-Theme Testing

```json
{
  "urls": [
    {
      "url": "http://localhost:3000/CRUDkit/themes",
      "label": "Light Theme Test",
      "actions": ["click element [data-theme='light']", "wait for 500"]
    },
    {
      "url": "http://localhost:3000/CRUDkit/themes",
      "label": "Dark Theme Test",
      "actions": ["click element [data-theme='dark']", "wait for 500"]
    },
    {
      "url": "http://localhost:3000/CRUDkit/themes",
      "label": "High Contrast Test",
      "actions": ["click element [data-theme='contrast']", "wait for 500"]
    }
  ]
}
```

## Package.json Scripts Integration

```json
{
  "scripts": {
    "test:a11y": "pa11y-ci",
    "test:a11y:dev": "pa11y-ci --config .pa11yci/dev-config.json",
    "test:a11y:ci": "pa11y-ci --config .pa11yci/ci-config.json",
    "test:a11y:report": "pa11y-ci --reporter html",
    "test:a11y:json": "pa11y-ci --reporter json",
    "test:a11y:single": "pa11y http://localhost:3000/CRUDkit --standard WCAG2AA"
  }
}
```

## Error Handling Configuration

### Exit Codes

- **0**: All tests passed
- **1**: Accessibility violations found
- **2**: Configuration error
- **3**: Network/timeout error

### Error Thresholds

```json
{
  "threshold": {
    "errors": 0, // Maximum errors allowed
    "warnings": 10, // Maximum warnings allowed
    "notices": -1 // Unlimited notices (-1)
  }
}
```

## Performance Optimization

### Concurrent Testing

```json
{
  "concurrency": 3, // Test 3 URLs simultaneously
  "maxConcurrency": 5 // Maximum concurrent tests
}
```

### Resource Management

```json
{
  "chromeLaunchConfig": {
    "args": [
      "--memory-pressure-off",
      "--max_old_space_size=4096",
      "--disable-extensions",
      "--disable-plugins"
    ]
  }
}
```

This configuration contract ensures consistent and comprehensive accessibility testing across all environments while providing flexibility for specific testing scenarios.
