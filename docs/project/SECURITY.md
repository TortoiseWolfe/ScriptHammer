# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of CRUDkit seriously. If you believe you have found a security vulnerability in CRUDkit, please report it to us as described below.

### Please do NOT:

- Open a public GitHub issue for security vulnerabilities
- Post about the vulnerability on social media or forums before it's fixed

### Please DO:

- Email us at security@scripthammer.example (replace with your actual security email)
- Include the following information in your report:
  - Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
  - Full paths of source file(s) related to the manifestation of the issue
  - The location of the affected source code (tag/branch/commit or direct URL)
  - Any special configuration required to reproduce the issue
  - Step-by-step instructions to reproduce the issue
  - Proof-of-concept or exploit code (if possible)
  - Impact of the issue, including how an attacker might exploit the issue

### What to expect:

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Initial Assessment**: Within 7 days, we will provide an initial assessment of the vulnerability
- **Resolution Timeline**: We aim to resolve critical vulnerabilities within 30 days
- **Disclosure**: We will coordinate with you on the disclosure timeline

## Security Best Practices

When using CRUDkit in production, we recommend:

### 1. Environment Variables

- Never commit `.env` files to version control
- Use environment-specific configurations
- Rotate secrets regularly
- Use strong, unique passwords for all services

### 2. Dependencies

- Keep all dependencies up to date
- Run `pnpm audit` regularly to check for known vulnerabilities
- Review dependency licenses and security policies
- Use exact versions in production (`pnpm install --frozen-lockfile`)

### 3. Input Validation

- All user inputs are validated using Zod schemas
- Never trust client-side validation alone
- Sanitize all data before storage
- Use parameterized queries for database operations

### 4. Authentication & Authorization

- Implement proper session management
- Use secure cookie settings (httpOnly, secure, sameSite)
- Implement rate limiting for authentication endpoints
- Use strong password policies (enforced via Zod schemas)

### 5. Content Security Policy (CSP)

The application implements a strict CSP in `src/app/layout.tsx` (via meta tag for static export compatibility):

**Current CSP Directives:**

- `default-src 'self'` - Only allow resources from same origin
- `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com` - Scripts from self, inline (for theme init), and Google Analytics
- `style-src 'self' 'unsafe-inline' https://unpkg.com` - Styles from self, inline, and unpkg (Leaflet)
- `img-src 'self' data: https: blob:` - Images from self, data URIs, HTTPS, and blob URLs
- `font-src 'self' data:` - Fonts from self and data URIs
- `connect-src 'self' https://www.googleapis.com https://*.google-analytics.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org` - API connections
- `frame-src 'self' https://www.google.com` - Frames from self and Google (reCAPTCHA)
- `object-src 'none'` - No plugins (Flash, Java, etc.)
- `base-uri 'self'` - Prevent base tag hijacking
- `form-action 'self' https://api.web3forms.com` - Form submissions to self and Web3Forms
- `upgrade-insecure-requests` - Upgrade HTTP to HTTPS

**Security Note:** The `'unsafe-eval'` directive has been intentionally removed to prevent eval-based XSS attacks. This is a critical security improvement.

### 6. HTTPS & Security Headers

- Always use HTTPS in production
- Security headers are configured in `next.config.ts`:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: Restricts access to sensitive browser features

### 7. Docker Security

- Run containers with non-root users when possible
- Keep base images updated
- Scan images for vulnerabilities
- Use multi-stage builds to minimize attack surface
- Never include secrets in Docker images

### 8. Data Protection

- Implement proper data encryption at rest and in transit
- Follow GDPR/CCPA guidelines for user data
- Implement data retention policies
- Provide data export and deletion capabilities

## Security Features

CRUDkit includes several built-in security features:

### Form Validation

- Comprehensive Zod validation schemas for all forms
- Client and server-side validation
- Protection against common injection attacks
- Sanitization of user inputs

### Error Handling

- Global error boundaries to prevent information leakage
- Structured error logging
- User-friendly error messages that don't expose sensitive information

### PWA Security

- Service worker with integrity checks
- Secure offline caching strategies
- HTTPS-only PWA installation

### Development Security

- Pre-commit hooks for security checks
- Automated dependency updates via Dependabot
- TypeScript strict mode for type safety
- ESLint security rules

## Security Checklist for Deployment

Before deploying to production, ensure:

- [ ] All environment variables are properly configured
- [ ] Database connections use SSL/TLS
- [ ] API endpoints are properly authenticated
- [ ] Rate limiting is implemented
- [ ] Logging doesn't include sensitive information
- [ ] Error messages don't leak system information
- [ ] CORS is properly configured
- [ ] File uploads are restricted and validated
- [ ] Session management is secure
- [ ] Regular security audits are scheduled

## Automated Security Tools

We use the following tools to maintain security:

- **pnpm audit**: Checks for known vulnerabilities in dependencies
- **Dependabot**: Automated dependency updates with security patches
- **TypeScript**: Type safety to prevent runtime errors
- **ESLint**: Static code analysis with security rules
- **Husky**: Pre-commit hooks for security checks

## Contact

For any security-related questions or concerns, please contact:

- Security Email: security@scripthammer.example (replace with actual email)
- Project Maintainers: See CONTRIBUTING.md

## Acknowledgments

We appreciate the security research community's efforts in helping keep CRUDkit and our users safe. Responsible disclosure of vulnerabilities helps us ensure the security and privacy of our users.

---

Last Updated: September 2025
Version: 1.0.0
