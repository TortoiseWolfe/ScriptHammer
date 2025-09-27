---
title: 'CSP Headers: Your XSS Force Field'
slug: 'security-csp-headers'
excerpt: 'Content Security Policy - the security header that stops attacks before they start.'
author: 'TortoiseWolfe'
publishDate: 2025-11-15
status: 'published'
featured: false
categories:
  - Security
  - Web
  - Protection
tags:
  - csp
  - security
  - headers
  - xss
  - protection
readTime: 7
ogImage: '/blog-images/2025-11-15-security-csp-headers.png'
---

# CSP Headers: Your XSS Force Field

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The British Airways Hack 💳

**2018**: 380,000 payment cards stolen
**How**: Malicious JavaScript injected
**Impact**: £183 million fine
**Prevention**: One CSP header

Don't be British Airways.

## CSP in 30 Seconds 🛡️

```javascript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
  );

  return response;
}
```

XSS attacks now impossible. Done.

## The Gradual Rollout 📈

```javascript
// Start with report-only
const cspHeader = `
  default-src 'self';
  script-src 'self' https://trusted-cdn.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  report-uri /api/csp-report;
`;

// Report violations without blocking
response.headers.set('Content-Security-Policy-Report-Only', cspHeader);

// After testing, enforce it
response.headers.set('Content-Security-Policy', cspHeader);
```

## Nonce-Based Scripts (Maximum Security) 🔐

```javascript
// Generate nonce per request
const nonce = crypto.randomBytes(16).toString('base64');

// Add to CSP
const csp = `script-src 'nonce-${nonce}';`;

// Use in your HTML
<script nonce={nonce}>
  // This script runs
</script>

<script>
  // This script blocked (no nonce)
</script>
```

Even if attacker injects script, no nonce = no run.

## The Violation Reporter 📊

```javascript
// api/csp-report.ts
export async function POST(request: Request) {
  const violation = await request.json();

  console.error('CSP Violation:', {
    document: violation['document-uri'],
    violated: violation['violated-directive'],
    blocked: violation['blocked-uri'],
    lineNumber: violation['line-number']
  });

  // Alert on suspicious violations
  if (violation['blocked-uri'].includes('evil.com')) {
    await alertSecurityTeam(violation);
  }

  return new Response('Reported', { status: 204 });
}
```

Know about attacks in real-time.

## Development vs Production 🔧

```javascript
const isDev = process.env.NODE_ENV === 'development';

const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    isDev && "'unsafe-eval'", // Hot reload needs this
  ].filter(Boolean),
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Emotion/styled-components need this
  ],
  'connect-src': [
    "'self'",
    isDev && 'ws://localhost:3000', // WebSocket for hot reload
  ].filter(Boolean),
};
```

Secure in production. Convenient in development.

## Third-Party Scripts (The Right Way) 📦

```javascript
// Bad: Allow all Google
script-src https://*.google.com;

// Good: Specific services only
script-src
  'self'
  https://www.google-analytics.com/analytics.js
  https://www.googletagmanager.com/gtag/js;

// Best: Use SRI hashes
<script
  src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"
  integrity="sha384-Qn7..."
  crossorigin="anonymous"
></script>
```

## Frame Protection 🖼️

```javascript
// Prevent clickjacking
response.headers.set('X-Frame-Options', 'SAMEORIGIN');

// Or with CSP
frame-ancestors 'self';

// Allow specific domains
frame-ancestors 'self' https://trusted-partner.com;
```

No more invisible iframes stealing clicks.

## The Security Headers Suite 🎯

```javascript
// The complete protection
const securityHeaders = {
  'Content-Security-Policy': cspHeader,
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

Object.entries(securityHeaders).forEach(([key, value]) => {
  response.headers.set(key, value);
});
```

## Testing Your CSP 🧪

```bash
# Check your headers
curl -I https://yoursite.com

# Use online tools
https://securityheaders.com
https://csp-evaluator.withgoogle.com

# Monitor in browser
// Open DevTools Console
// Look for CSP violations
```

## Common Gotchas & Fixes 🐛

```javascript
// Inline styles blocked?
// Option 1: Move to CSS files
// Option 2: Use nonces
// Option 3: Hash the styles

// Google Fonts broken?
style-src 'self' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;

// Stripe/PayPal broken?
script-src 'self' https://js.stripe.com;
frame-src 'self' https://checkout.stripe.com;
```

## Real World Impact 📊

**Before CSP**:

- XSS vulnerabilities: Unknown
- Attack surface: Huge
- Compliance: Failed
- Sleep quality: Poor

**After CSP**:

- XSS vulnerabilities: 0
- Attack surface: Minimal
- Compliance: Passed
- Sleep quality: Excellent

## Deploy CSP Today

```javascript
// 1. Start with report-only
// 2. Monitor for a week
// 3. Fix violations
// 4. Enable enforcement
// 5. Sleep better

// The header that pays for itself
// in avoided breaches
```

Stop hoping attackers don't find you.
Start blocking them automatically.

Security headers: Set once, protected forever.
