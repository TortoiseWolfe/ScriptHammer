# Security Touchpoints Inventory

Generated: 2026-01-15 | Refresh: `/refresh-inventories`

## Discovery Method

This inventory is **dynamically generated** by scanning all feature specs for security-related keywords:
`auth`, `security`, `privacy`, `RLS`, `OWASP`, `consent`, `password`, `session`, `token`, `encryption`

After forking, run `/refresh-inventories` to discover your project's security features.

## Discovered Security Features

| Feature          | Focus                                        | Priority        |
| ---------------- | -------------------------------------------- | --------------- |
| **000-RLS**      | Row-Level Security policies for all tables   | Foundation      |
| **002-Cookie**   | Cookie consent system                        | Privacy         |
| **003-Auth**     | Email/password, OAuth, session management    | Foundation      |
| **005-Security** | Data isolation, CSRF, brute force prevention | Foundation      |
| **013-OAuth**    | OAuth messaging password                     | Auth            |
| **014-Admin**    | Admin welcome email gate                     | Auth            |
| **019-Consent**  | Analytics consent, GDPR compliance           | Pre-integration |

## Security Touchpoints by Category

### Data Isolation (RLS)

- `000`: User data isolation - profiles, preferences, activity
- `000`: Service role operations for backend functions
- `005`: Payment data isolation between users
- `042`: Payment-specific RLS policies

### Authentication

- `003`: Email/password registration with verification
- `003`: Session management (7-day default, 30-day remember me)
- `003`: Password reset flow
- `013`: OAuth messaging password
- `015`: OAuth display name handling

### Authorization

- `003`: Role-based access (user, admin)
- `005`: OAuth callback verification (CSRF prevention)
- `014`: Admin welcome email gate

### Attack Prevention

- `005`: Brute force prevention (server-side rate limiting)
- `005`: OAuth state parameter verification
- `005`: Authorization code replay prevention
- `003`: Account lockout after 5 failed attempts (15 min)

### Privacy & Consent

- `019`: Analytics consent before any tracking
- `002`: Cookie consent modal
- `002`: Preference management UI
- Constitution: Privacy First principle

### Audit & Logging

- `005`: Security event audit logging
- `044`: Error handler integrations (Sentry/LogRocket) - requires consent

## OWASP Top 10 Coverage

| OWASP Risk                    | Feature Coverage        |
| ----------------------------- | ----------------------- |
| A01 Broken Access Control     | 000-RLS, 003-Auth       |
| A02 Cryptographic Failures    | 003-Auth (hashing)      |
| A03 Injection                 | Supabase RLS policies   |
| A04 Insecure Design           | Constitution principles |
| A05 Security Misconfiguration | 005-Security            |
| A06 Vulnerable Components     | DevOps scanning         |
| A07 Auth Failures             | 003-Auth, 005-Security  |
| A08 Software Integrity        | CI/CD validation        |
| A09 Logging Failures          | 005-Audit, 044-Error    |
| A10 SSRF                      | Supabase Edge Functions |

## Secrets Management

| Location       | Type                      |
| -------------- | ------------------------- |
| Supabase Vault | API keys, OAuth secrets   |
| GitHub Secrets | CI/CD tokens              |
| `.env.local`   | Dev-only, never committed |

**Rule**: Never store secrets in client code. Use `NEXT_PUBLIC_*` only for non-sensitive config.

## Quick Security Checks

```bash
# Find potential secrets in code
grep -r "sk_\|api_key\|secret" --include="*.ts" --include="*.tsx"

# Check RLS policies
supabase db diff --schema public

# Review auth flows
grep -r "supabase.auth" --include="*.ts"
```
