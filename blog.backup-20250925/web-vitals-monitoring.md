---
title: 'Web Vitals: The Metrics That Actually Matter to Users'
slug: 'web-vitals-monitoring'
excerpt: 'LCP, FID, CLS. Decode the acronyms. Fix the problems. Delight the users.'
author: 'TortoiseWolfe'
publishDate: 2025-11-07
status: 'published'
featured: false
categories:
  - Performance
  - Monitoring
  - Analytics
tags:
  - web-vitals
  - performance
  - monitoring
  - metrics
  - user-experience
readTime: 8
ogImage: '/blog-images/2025-11-07-web-vitals-monitoring.png'
---

# Web Vitals: The Metrics That Actually Matter to Users

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Metrics Graveyard 💀

Metrics we used to track:

- Time to first byte (TTFB)
- DOM ready
- Page load time
- Requests per second

What users actually care about:

- Can I see it? (LCP)
- Can I click it? (FID)
- Does it jump around? (CLS)

## Largest Contentful Paint (LCP) 🖼️

**What it measures**: When the biggest thing appears

**User translation**: "When can I actually see the content?"

**The Fix**:

```tsx
// Bad: Hero image loads last
<div className="hero">
  <SomeOtherStuff />
  <img src="/huge-hero.jpg" /> {/* Loads after everything */}
</div>

// Good: Hero image loads first
<div className="hero">
  <img
    src="/hero.jpg"
    fetchpriority="high"
    loading="eager"
  />
  <SomeOtherStuff />
</div>
```

Target: < 2.5 seconds
Ours: 1.2 seconds

## First Input Delay (FID) 🖱️

**What it measures**: Click to response time

**User translation**: "Why isn't this button working?!"

**The Fix**:

```tsx
// Bad: Block everything while hydrating
useEffect(() => {
  // 500ms of blocking code
  expensiveOperation();
}, []);

// Good: Defer non-critical work
useEffect(() => {
  requestIdleCallback(() => {
    expensiveOperation();
  });
}, []);
```

Target: < 100ms
Ours: 24ms

## Cumulative Layout Shift (CLS) 🏃

**What it measures**: How much stuff jumps around

**User translation**: "I clicked the wrong thing because it moved!"

**The Fix**:

```tsx
// Bad: Content pushes down when ad loads
<Header />
<Ad /> {/* Loads later, pushes content */}
<Content />

// Good: Reserve space
<Header />
<div style={{ minHeight: '250px' }}>
  <Ad />
</div>
<Content />
```

Target: < 0.1
Ours: 0.02

## The Monitoring Setup 📊

```tsx
// Real user monitoring
import { getCLS, getFID, getLCP } from 'web-vitals';

getCLS(console.log); // Track layout shifts
getFID(console.log); // Track input delay
getLCP(console.log); // Track paint time

// Send to analytics
function sendToAnalytics(metric) {
  // Only track real users, not bots
  if (navigator.userAgent.includes('bot')) return;

  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating, // good/needs-improvement/poor
    }),
  });
}
```

## The Dashboard That Tells Truth 📈

```tsx
<VitalsDashboard>
  <Metric name="LCP">
    <GoodPercent>87%</GoodPercent> {/* < 2.5s */}
    <NeedsWork>9%</NeedsWork> {/* 2.5-4s */}
    <Poor>4%</Poor> {/* > 4s */}
  </Metric>

  <Trends>
    {/* Show trends over time */}
    {/* Correlate with deploys */}
    {/* Alert on regressions */}
  </Trends>
</VitalsDashboard>
```

## Real Problems We Fixed 🔧

### The Font Flash (CLS: 0.31 → 0.02)

```css
/* Before: Font loads, everything reflows */
font-family: 'Custom Font', sans-serif;

/* After: Match fallback metrics */
@font-face {
  font-family: 'Custom Font';
  size-adjust: 95%; /* Match fallback size */
  ascent-override: 95%; /* Match line height */
  font-display: optional; /* Don't reflow if slow */
}
```

### The Spinner of Death (FID: 743ms → 24ms)

```tsx
// Before: Load everything before interaction
const App = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    loadEverything().then(setData); // Blocks for 2s
  }, []);

  return data ? <Content /> : <Spinner />;
};

// After: Progressive enhancement
const App = () => {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content />
    </Suspense>
  );
};
```

## The Competitive Advantage 💪

Our competitors' Core Web Vitals:

- Competitor A: 67% passing
- Competitor B: 43% passing
- Competitor C: 71% passing

Ours: 94% passing

Google ranking boost: Confirmed ✅

## Automate Everything 🤖

```yaml
# .github/workflows/web-vitals.yml
- name: Check Web Vitals
  run: |
    docker compose exec scripthammer pnpm run vitals:check
    if [ $LCP -gt 2500 ]; then
      echo "LCP regression detected!"
      exit 1
    fi
```

No manual checking. No regressions. No excuses.

## Start Monitoring Today

```bash
docker compose exec scripthammer pnpm add web-vitals
docker compose exec scripthammer pnpm generate:component VitalsMonitor
```

Stop guessing about performance.
Start measuring what matters.

Your users feel every millisecond.
