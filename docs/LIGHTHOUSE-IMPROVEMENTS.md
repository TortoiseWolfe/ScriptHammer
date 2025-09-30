# Lighthouse Score Improvement Plan

**Last Updated:** 2025-09-29
**Current Scores:**

- Performance: 92/100 ⚠️
- Accessibility: 98/100 ⚠️
- Best Practices: 95/100 ⚠️
- SEO: 100/100 ✅
- PWA: 92/100 ⚠️

**Goal:** Achieve 95+ on all categories

---

## 🎯 Performance (92 → 95+)

### Issue 1: Large JavaScript Bundles ❌

**Impact:** High
**Effort:** Medium
**Files:** `next.config.ts`, webpack configuration

**Current State:**

- Total JS: 320KB
- First Load JS: 88KB
- Some pages load unnecessary JavaScript

**Action Items:**

1. Implement code splitting for heavy components

   ```typescript
   // Use dynamic imports for large components
   const BlogEditor = dynamic(() => import('@/components/blog/BlogEditor'), {
     loading: () => <div>Loading editor...</div>,
     ssr: false
   });
   ```

2. Split vendor bundles

   ```typescript
   // next.config.ts
   webpack: (config) => {
     config.optimization.splitChunks = {
       chunks: 'all',
       cacheGroups: {
         vendor: {
           test: /[\\/]node_modules[\\/]/,
           priority: -10,
         },
       },
     };
     return config;
   };
   ```

3. Lazy load non-critical features
   - Blog components (only load on /blog routes)
   - Map components (only load on /map route)
   - Game components (only load on /game route)

**Expected Improvement:** +2-3 points

---

### Issue 2: Reduce Unused JavaScript ❌

**Impact:** High
**Effort:** Medium
**Files:** All component files, `package.json`

**Current State:**

- Tailwind CSS includes unused utilities
- Some dependencies bundle unused code
- DaisyUI themes include all 32 themes

**Action Items:**

1. Enable Tailwind JIT and purge

   ```javascript
   // tailwind.config.js - already configured
   content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
   ```

2. Analyze and remove unused dependencies

   ```bash
   npx depcheck
   ```

3. Use tree-shakeable imports

   ```typescript
   // Bad
   import * as _ from 'lodash';

   // Good
   import debounce from 'lodash/debounce';
   ```

4. Consider theme optimization (future)
   - Only include actively used themes
   - Currently using all 32 DaisyUI themes

**Expected Improvement:** +1-2 points

---

### Issue 3: Time to Interactive (TTI) ❌

**Impact:** Medium
**Effort:** Medium
**Files:** Service Worker, critical path scripts

**Current State:**

- TTI: ~3.5s
- Main thread blocking time: 150ms

**Action Items:**

1. Defer non-critical JavaScript

   ```typescript
   // Move analytics to defer
   <Script strategy="lazyOnload" />
   ```

2. Optimize Service Worker registration

   ```typescript
   // Register after load
   if ('serviceWorker' in navigator) {
     window.addEventListener('load', () => {
       navigator.serviceWorker.register('/sw.js');
     });
   }
   ```

3. Use requestIdleCallback for non-urgent tasks
   ```typescript
   if ('requestIdleCallback' in window) {
     requestIdleCallback(() => {
       // Non-critical initialization
     });
   }
   ```

**Expected Improvement:** +1 point

---

## ♿ Accessibility (98 → 100)

### Issue 4: Buttons Missing Accessible Names ❌

**Impact:** High
**Effort:** Low
**Files:** Icon button components

**Current State:**

- Some icon-only buttons lack `aria-label`
- Tooltip hover buttons need better labels

**Action Items:**

1. Audit all icon buttons

   ```bash
   grep -r "btn-circle" src/
   grep -r "btn-ghost btn-xs" src/
   ```

2. Add aria-labels to all icon buttons

   ```tsx
   <button
     className="btn btn-circle btn-ghost btn-xs"
     aria-label="Learn more about performance metrics"
   >
     <InfoIcon />
   </button>
   ```

3. Files to check:
   - `src/app/status/page.tsx` (info tooltips)
   - `src/components/navigation/*.tsx`
   - Any custom icon buttons

**Expected Improvement:** +1 point

---

### Issue 5: Form Input Labels ❌

**Impact:** Medium
**Effort:** Low
**Files:** Form components

**Current State:**

- Some form inputs use placeholder as label
- Missing explicit label associations

**Action Items:**

1. Audit all forms

   ```bash
   grep -r "input" src/components/ | grep -v "aria-label"
   ```

2. Ensure all inputs have labels

   ```tsx
   <label htmlFor="email" className="label">
     <span className="label-text">Email</span>
   </label>
   <input
     id="email"
     type="email"
     aria-describedby="email-hint"
   />
   ```

3. Files to check:
   - `src/app/contact/page.tsx`
   - Any form components in `src/components/`

**Expected Improvement:** +1 point

---

## 🔒 Best Practices (95 → 100)

### Issue 6: Content Security Policy (CSP) ❌

**Impact:** High
**Effort:** Medium
**Files:** `next.config.ts`, middleware

**Current State:**

- No CSP headers configured
- Vulnerable to XSS if script injection occurs

**Action Items:**

1. Add CSP headers to next.config.ts

   ```typescript
   async headers() {
     return [
       {
         source: '/:path*',
         headers: [
           {
             key: 'Content-Security-Policy',
             value: [
               "default-src 'self'",
               "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
               "style-src 'self' 'unsafe-inline'",
               "img-src 'self' data: https:",
               "font-src 'self' data:",
               "connect-src 'self' https://www.googleapis.com",
             ].join('; ')
           }
         ]
       }
     ];
   }
   ```

2. Test CSP doesn't break functionality
   - Google Analytics
   - External fonts
   - Map tiles (OpenStreetMap)

3. Gradually tighten policy
   - Remove 'unsafe-inline' where possible
   - Use nonces for inline scripts

**Expected Improvement:** +3 points

---

### Issue 7: Subresource Integrity (SRI) ❌

**Impact:** Low
**Effort:** Low
**Files:** External script tags

**Current State:**

- External scripts loaded without integrity checks
- Google Analytics loaded via Next.js Script component

**Action Items:**

1. Add SRI to external scripts

   ```tsx
   <Script
     src="https://cdn.example.com/library.js"
     integrity="sha384-ABC123..."
     crossOrigin="anonymous"
   />
   ```

2. Generate SRI hashes

   ```bash
   curl https://cdn.example.com/library.js | openssl dgst -sha384 -binary | openssl base64 -A
   ```

3. Scripts to secure:
   - Check if any external CDN scripts are used
   - Google Analytics is already via Next.js Script (safe)

**Expected Improvement:** +2 points

---

## 📱 PWA (92 → 95+)

### Issue 8: Maskable App Icons ❌

**Impact:** High
**Effort:** Medium
**Files:** `public/images/icons/`, `manifest.json`

**Current State:**

- Icons exist but not maskable format
- No 192x192 and 512x512 PNG with safe zones

**Action Items:**

1. Create maskable icons with safe zones
   - Design icon with 20% padding (safe zone)
   - Export as 192x192px PNG
   - Export as 512x512px PNG

2. Tools to use:
   - [Maskable.app](https://maskable.app/editor) - Test and preview
   - Figma/Sketch - Design with guides

3. Update manifest.json
   ```json
   {
     "icons": [
       {
         "src": "/images/icons/icon-192x192-maskable.png",
         "sizes": "192x192",
         "type": "image/png",
         "purpose": "maskable"
       },
       {
         "src": "/images/icons/icon-512x512-maskable.png",
         "sizes": "512x512",
         "type": "image/png",
         "purpose": "maskable"
       }
     ]
   }
   ```

**Expected Improvement:** +2 points

---

### Issue 9: Apple Touch Icon ❌

**Impact:** Medium
**Effort:** Low
**Files:** `public/`, `src/app/layout.tsx`

**Current State:**

- No apple-touch-icon.png in public/
- iOS users get generic icon

**Action Items:**

1. Create 180x180px PNG

   ```bash
   # Using ImageMagick
   convert icon.png -resize 180x180 apple-touch-icon.png
   ```

2. Add to layout.tsx

   ```tsx
   <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
   ```

3. Optional: Add multiple sizes
   ```tsx
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
   <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152.png" />
   <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120.png" />
   ```

**Expected Improvement:** +1 point

---

### Issue 10: Screenshots in Manifest ❌

**Impact:** Low
**Effort:** Low
**Files:** `public/screenshots/`, `public/manifest.json`

**Current State:**

- Manifest references screenshots but they don't exist
- Missing visual preview for app stores

**Action Items:**

1. Take screenshots
   - Desktop: 1280x720 or 1920x1080
   - Mobile: 750x1334 (iPhone) or similar
   - Show key features/pages

2. Optimize and save

   ```bash
   mkdir -p public/screenshots
   # Save as screenshot-1.png, screenshot-2.png, etc.
   ```

3. Update manifest.json
   ```json
   {
     "screenshots": [
       {
         "src": "/screenshots/desktop-home.png",
         "sizes": "1280x720",
         "type": "image/png",
         "form_factor": "wide"
       },
       {
         "src": "/screenshots/mobile-home.png",
         "sizes": "750x1334",
         "type": "image/png",
         "form_factor": "narrow"
       }
     ]
   }
   ```

**Expected Improvement:** +1 point

---

### Issue 11: Splash Screen Configuration ❌

**Impact:** Low
**Effort:** Low
**Files:** `public/manifest.json`, iOS meta tags

**Current State:**

- No splash screen configured
- Default white screen on launch

**Action Items:**

1. Add background_color to manifest

   ```json
   {
     "background_color": "#1a1a1a",
     "theme_color": "#3b82f6"
   }
   ```

2. Add iOS splash screens (optional)

   ```tsx
   // In layout.tsx
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
   ```

3. Create launch images for iOS (optional)
   - Multiple sizes needed for different devices
   - Use [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)

**Expected Improvement:** <1 point (nice-to-have)

---

## 📊 Implementation Priority

### Phase 1: Quick Wins (1-2 hours)

1. ✅ Add aria-labels to icon buttons
2. ✅ Fix form input labels
3. ✅ Add Apple touch icon
4. ✅ Configure splash screen background

**Expected Score:** Performance: 92, Accessibility: 100, Best Practices: 95, PWA: 94

---

### Phase 2: Medium Effort (4-6 hours)

1. ✅ Create maskable icons
2. ✅ Add screenshots to manifest
3. ✅ Implement code splitting
4. ✅ Add Content Security Policy

**Expected Score:** Performance: 94, Accessibility: 100, Best Practices: 98, PWA: 96

---

### Phase 3: Optimization (8-10 hours)

1. ✅ Reduce unused JavaScript (deep analysis)
2. ✅ Optimize Time to Interactive
3. ✅ Add Subresource Integrity
4. ✅ Fine-tune CSP policy

**Expected Score:** Performance: 96+, Accessibility: 100, Best Practices: 100, PWA: 98

---

## 🎯 Target Scores After Implementation

| Category       | Current | Phase 1 | Phase 2 | Phase 3 |
| -------------- | ------- | ------- | ------- | ------- |
| Performance    | 92      | 92      | 94      | 96+     |
| Accessibility  | 98      | 100     | 100     | 100     |
| Best Practices | 95      | 95      | 98      | 100     |
| SEO            | 100     | 100     | 100     | 100     |
| PWA            | 92      | 94      | 96      | 98      |

---

## 📝 Notes

- All improvements should maintain backward compatibility
- Test in production environment after each phase
- Monitor bundle size changes with each optimization
- Keep `.env.example` updated with any new variables
- Document breaking changes in CHANGELOG.md

## 🔗 Resources

- [Lighthouse Scoring Guide](https://web.dev/performance-scoring/)
- [Next.js Performance Best Practices](https://nextjs.org/docs/pages/building-your-application/optimizing)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Content Security Policy Guide](https://content-security-policy.com/)
- [Maskable Icons Guide](https://web.dev/maskable-icon/)
