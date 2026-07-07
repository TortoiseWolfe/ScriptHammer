# Security Headers Configuration

Since Next.js static export (`output: 'export'`) doesn't support the `headers()` function in `next.config.ts`, security headers must be configured at the hosting/server level.

## Why Security Headers Matter

Security headers protect your application from common web vulnerabilities:

- **CSP**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **HSTS**: Forces HTTPS connections
- **X-Content-Type-Options**: Prevents MIME type sniffing

## Recommended Headers

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://assets.calendly.com https://app.cal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com https://assets.calendly.com; img-src 'self' data: https: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com; connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.tile.openstreetmap.org https://api.emailjs.com https://api.web3forms.com https://calendly.com https://api.calendly.com https://app.cal.com wss://app.cal.com; media-src 'self'; object-src 'none'; frame-src 'self' https://calendly.com https://app.cal.com; base-uri 'self'; form-action 'self' https://api.web3forms.com; frame-ancestors 'none'; upgrade-insecure-requests;
X-DNS-Prefetch-Control: on
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self), interest-cohort=()
```

## Configuration by Platform

### Vercel

Create `vercel.json` in your project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com; img-src 'self' data: https: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com; connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
        },
        {
          "key": "X-DNS-Prefetch-Control",
          "value": "on"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(self), interest-cohort=()"
        }
      ]
    }
  ]
}
```

### Netlify

Create `_headers` file in your `public` directory:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://assets.calendly.com https://app.cal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com https://assets.calendly.com; img-src 'self' data: https: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com; connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.tile.openstreetmap.org https://api.emailjs.com https://api.web3forms.com https://calendly.com https://api.calendly.com https://app.cal.com wss://app.cal.com; media-src 'self'; object-src 'none'; frame-src 'self' https://calendly.com https://app.cal.com; base-uri 'self'; form-action 'self' https://api.web3forms.com; frame-ancestors 'none'; upgrade-insecure-requests;
  X-DNS-Prefetch-Control: on
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(self), interest-cohort=()
```

### nginx

Add to your nginx server block:

```nginx
server {
    # ... other configuration ...

    # Security headers
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com; img-src 'self' data: https: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com; connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" always;
    add_header X-DNS-Prefetch-Control "on" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self), interest-cohort=()" always;

    # ... rest of configuration ...
}
```

### Apache

Add to your `.htaccess` file:

```apache
<IfModule mod_headers.c>
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com; img-src 'self' data: https: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com; connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
    Header always set X-DNS-Prefetch-Control "on"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(self), interest-cohort=()"
</IfModule>
```

### CloudFlare Pages

Create `_headers` file in your output directory:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://assets.calendly.com https://app.cal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com https://assets.calendly.com; img-src 'self' data: https: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com; connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.tile.openstreetmap.org https://api.emailjs.com https://api.web3forms.com https://calendly.com https://api.calendly.com https://app.cal.com wss://app.cal.com; media-src 'self'; object-src 'none'; frame-src 'self' https://calendly.com https://app.cal.com; base-uri 'self'; form-action 'self' https://api.web3forms.com; frame-ancestors 'none'; upgrade-insecure-requests;
  X-DNS-Prefetch-Control: on
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(self), interest-cohort=()
```

Or use CloudFlare Workers for more control:

```javascript
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const response = await fetch(request);
  const newHeaders = new Headers(response.headers);

  // Add security headers
  newHeaders.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com; img-src 'self' data: https: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com; connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.tile.openstreetmap.org; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
  );
  newHeaders.set('X-DNS-Prefetch-Control', 'on');
  newHeaders.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-XSS-Protection', '1; mode=block');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newHeaders.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
```

### GitHub Pages

GitHub Pages doesn't support custom headers directly. Consider:

1. Using CloudFlare as a proxy (free tier available)
2. Implementing CSP via meta tags in your HTML (limited compared to HTTP headers)
3. Using a different hosting provider that supports headers

## Testing Your Headers

After deployment, test your security headers using:

1. **Security Headers Scanner**: https://securityheaders.com
2. **Mozilla Observatory**: https://observatory.mozilla.org
3. **Chrome DevTools**: Network tab → Response Headers

## CSP Adjustments

You may need to adjust the CSP policy based on your specific needs:

- **Calendar embeds**: Add iframe sources for Calendly/Cal.com
- **Additional analytics**: Add domains for other analytics services
- **External APIs**: Add to `connect-src` for API calls
- **CDN assets**: Add to appropriate directives

## Service-Specific CSP Requirements

### EmailJS & Web3Forms

- **connect-src**: `https://api.emailjs.com https://api.web3forms.com`
- **form-action**: `'self' https://api.web3forms.com`

### Calendly

- **script-src**: `https://assets.calendly.com`
- **style-src**: `https://assets.calendly.com`
- **connect-src**: `https://calendly.com https://api.calendly.com`
- **frame-src**: `https://calendly.com`

### Cal.com

- **script-src**: `https://app.cal.com`
- **connect-src**: `https://app.cal.com wss://app.cal.com`
- **frame-src**: `https://app.cal.com`

### OpenStreetMap (Leaflet)

- **img-src**: `https://*.tile.openstreetmap.org`
- **connect-src**: `https://*.tile.openstreetmap.org`

## Important Notes

1. **Static Export Limitation**: The `headers()` function in `next.config.ts` only works with Node.js runtime, not static exports
2. **Test Thoroughly**: Always test your headers in production environment
3. **CSP Reports**: Consider setting up CSP reporting to monitor violations
4. **Gradual Rollout**: Start with CSP in report-only mode if needed

## References

- [MDN Web Docs - HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Next.js Static Exports Documentation](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
