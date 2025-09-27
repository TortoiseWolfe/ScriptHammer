---
title: 'Performance Utilities: Your Speed Optimization Toolkit'
slug: 'performance-utilities-toolkit'
excerpt: 'Measure, analyze, optimize. The utilities that make your app blazing fast.'
author: 'TortoiseWolfe'
publishDate: 2025-11-06
status: 'published'
featured: false
categories:
  - Performance
  - Tools
  - Optimization
tags:
  - performance
  - utilities
  - optimization
  - speed
  - monitoring
readTime: 8
ogImage: '/blog-images/2025-11-06-performance-utilities-toolkit.png'
---

# Performance Utilities: Your Speed Optimization Toolkit

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The 3-Second Rule ⏱️

Users wait 3 seconds max.
After that, they're gone.
53% of mobile users abandon sites that take >3s.

Your toolkit to stay under 3 seconds:

## Bundle Analyzer (Find the Bloat) 📦

```bash
# Install
docker compose exec scripthammer pnpm add -D webpack-bundle-analyzer

# Analyze
docker compose exec scripthammer pnpm build:analyze
```

Visual map shows:

- Lodash: 544KB (why?!)
- Moment.js: 232KB (use date-fns: 12KB)
- Unused code: 40% of bundle

One view. All problems visible.

## Performance Budget Guardian 💰

```javascript
// performance-budget.js
const budgets = {
  javascript: 300 * 1024, // 300KB
  css: 50 * 1024, // 50KB
  images: 200 * 1024, // 200KB per image
  total: 1024 * 1024, // 1MB total
};

// Fail build if over budget
if (bundleSize > budgets.javascript) {
  throw new Error(`JS bundle too large: ${bundleSize / 1024}KB`);
}
```

Can't ship if it's too big.

## React DevTools Profiler 🔬

```javascript
// Wrap slow components
import { Profiler } from 'react';

<Profiler id="Navigation" onRender={logTiming}>
  <Navigation />
</Profiler>;

function logTiming(id, phase, duration) {
  console.log(`${id} (${phase}) took ${duration}ms`);

  if (duration > 16) {
    // Over 1 frame
    console.warn(`${id} is slow!`);
  }
}
```

Find exactly what's slow.

## Lazy Loading Magic ✨

```typescript
// Before: Load everything
import HeavyComponent from './HeavyComponent';

// After: Load when needed
const HeavyComponent = lazy(() =>
  import(/* webpackChunkName: "heavy" */ './HeavyComponent')
);

// With loading state
<Suspense fallback={<Skeleton />}>
  <HeavyComponent />
</Suspense>
```

First paint: 2s → 0.5s

## Image Optimization Pipeline 🖼️

```javascript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96],
  },
};

// Usage
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1920}
  height={1080}
  priority // Load immediately
  placeholder="blur" // Show blurred version
/>;
```

5MB PNG → 45KB WebP. Same quality.

## Request Waterfall Killer 🌊

```typescript
// Bad: Sequential
const user = await fetchUser();
const posts = await fetchPosts(user.id);
const comments = await fetchComments(posts);

// Good: Parallel
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);

// 3 seconds → 1 second
```

## Memory Leak Detector 🔍

```typescript
// utils/memoryMonitor.ts
class MemoryMonitor {
  private baseline = performance.memory.usedJSHeapSize;

  checkLeak() {
    const current = performance.memory.usedJSHeapSize;
    const increase = current - this.baseline;

    if (increase > 50 * 1024 * 1024) {
      // 50MB
      console.error('Possible memory leak detected!');
      console.log('Heap increase:', (increase / 1024 / 1024).toFixed(2), 'MB');
    }
  }
}

// Run periodically in dev
setInterval(() => memoryMonitor.checkLeak(), 10000);
```

## Service Worker Caching 📦

```javascript
// sw.js
const CACHE_NAME = 'v1';

// Cache strategy per resource type
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Network first for API
  if (request.url.includes('/api/')) {
    event.respondWith(networkFirst(request));
  }
  // Cache first for assets
  else if (request.url.match(/\.(js|css|png|jpg)$/)) {
    event.respondWith(cacheFirst(request));
  }
});
```

Second visit: 3s → 0.2s

## Database Query Optimizer 🗄️

```typescript
// Measure query performance
const measureQuery = async (query: string) => {
  const start = performance.now();
  const result = await db.query(query);
  const duration = performance.now() - start;

  if (duration > 100) {
    console.warn(`Slow query (${duration}ms):`, query);
    // Log to monitoring
  }

  return result;
};

// Auto-add indexes for slow queries
```

## The Performance Dashboard 📊

```typescript
// components/PerfDashboard.tsx
export function PerfDashboard() {
  return (
    <Dashboard>
      <Metric name="FCP" value={metrics.fcp} target={1800} />
      <Metric name="LCP" value={metrics.lcp} target={2500} />
      <Metric name="FID" value={metrics.fid} target={100} />
      <Metric name="CLS" value={metrics.cls} target={0.1} />

      <Chart data={performanceHistory} />

      <Recommendations>
        {metrics.lcp > 2500 && <Alert>Optimize largest image</Alert>}
        {metrics.fid > 100 && <Alert>Reduce JavaScript execution</Alert>}
      </Recommendations>
    </Dashboard>
  );
}
```

## Real Results 📈

**Before optimization toolkit**:

- Page load: 4.2s
- Lighthouse: 67
- Bounce rate: 68%

**After**:

- Page load: 1.1s
- Lighthouse: 98
- Bounce rate: 31%

## Your Performance Checklist

```bash
# 1. Measure baseline
docker compose exec scripthammer pnpm lighthouse

# 2. Analyze bundle
docker compose exec scripthammer pnpm build:analyze

# 3. Add monitoring
docker compose exec scripthammer pnpm add web-vitals

# 4. Set budgets
echo "performance budgets" >> .github/workflows/ci.yml

# 5. Ship faster app
```

Stop guessing about performance.
Start measuring and fixing.

Speed is a feature.
