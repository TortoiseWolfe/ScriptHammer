---
title: 'Performance: How We Got Our Lighthouse Score to 100'
slug: 'performance-optimization-techniques'
excerpt: 'From 34 to 100. Every optimization that actually mattered.'
author: 'TortoiseWolfe'
publishDate: 2025-11-05
status: 'published'
featured: false
categories:
  - Performance
  - Optimization
  - Technical
tags:
  - performance
  - optimization
  - lighthouse
  - speed
  - core-web-vitals
readTime: 10
ogImage: '/blog-images/2025-11-05-performance-optimization-techniques.png'
---

# Performance: How We Got Our Lighthouse Score to 100

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Shameful Beginning 😱

Our first Lighthouse audit:

- Performance: 34
- Accessibility: 67
- Best Practices: 58
- SEO: 71

The CEO asked: "Is this out of 1000?"

## The Journey to 100 💯

### Step 1: Image Optimization (34 → 52)

```tsx
// Before: 5MB hero image
<img src="/hero.png" />

// After: Responsive WebP with lazy loading
<Image
  src="/hero.webp"
  alt="Hero"
  loading="lazy"
  placeholder="blur"
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

Savings: 4.7MB on initial load

### Step 2: JavaScript Diet (52 → 68)

```tsx
// Before: Import everything
import * as Icons from 'react-icons';
import moment from 'moment';
import _ from 'lodash';

// After: Import what you need
import { FaHome } from 'react-icons/fa';
import { format } from 'date-fns';
import debounce from 'lodash/debounce';
```

Bundle size: 2.3MB → 487KB

### Step 3: Font Loading (68 → 76)

```tsx
// Before: Block everything for fonts
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />

// After: Critical font subset + async
<link rel="preload" href="/fonts/inter-var.woff2" as="font" crossorigin />
@font-face {
  font-family: 'Inter';
  font-display: swap; // Show text immediately
  src: url('/fonts/inter-var.woff2') format('woff2');
}
```

Text visible: 4.2s → 0.3s

### Step 4: Code Splitting (76 → 85)

```tsx
// Before: Load everything
import HeavyComponent from './HeavyComponent';

// After: Load when needed
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

Initial JS: 890KB → 215KB

### Step 5: Critical CSS (85 → 92)

```tsx
// Extract critical CSS
const critical = await getCriticalCSS(html);

// Inline in <head>
<style dangerouslySetInnerHTML={{ __html: critical }} />

// Load rest async
<link rel="preload" href="/styles.css" as="style" />
<link rel="stylesheet" href="/styles.css" media="print" onLoad="this.media='all'" />
```

First paint: 2.1s → 0.6s

### Step 6: Service Worker (92 → 98)

```tsx
// Cache everything intelligently
self.addEventListener('fetch', (event) => {
  // Network first for HTML
  // Cache first for assets
  // Stale-while-revalidate for API
});
```

Repeat visits: Instant

### Step 7: The Final Points (98 → 100)

```tsx
// Preconnect to required origins
<link rel="preconnect" href="https://api.example.com" />

// DNS prefetch for late discoveries
<link rel="dns-prefetch" href="https://analytics.example.com" />

// Preload critical resources
<link rel="preload" as="image" href="/hero.webp" />
```

## The Monitoring Stack 📊

```tsx
<PerformanceMonitor
  metrics={['FCP', 'LCP', 'FID', 'CLS', 'TTFB']}
  threshold={{
    LCP: 2500, // Warn if > 2.5s
    FID: 100, // Warn if > 100ms
    CLS: 0.1, // Warn if > 0.1
  }}
  alert={(metric) => {
    // Send to monitoring
    // Alert the team
    // Auto-rollback if critical
  }}
/>
```

## Real User Metrics 📈

**Before optimization**:

- Bounce rate: 71%
- Session duration: 0:47
- Pages per session: 1.3

**After optimization**:

- Bounce rate: 31%
- Session duration: 3:24
- Pages per session: 4.7

Speed = Money

## The Checklist ✅

```bash
# Run before every deploy
docker compose exec scripthammer pnpm run perf:check

✓ Bundle size < 500KB
✓ Images optimized
✓ Fonts subset
✓ CSS purged
✓ JS tree-shaken
✓ Service worker updated
✓ Lighthouse > 95
```

## Start Optimizing

```bash
docker compose exec scripthammer pnpm run lighthouse
```

Every millisecond counts.
Every byte matters.
Perfect scores are possible.

Your users are waiting. How fast can you be?
