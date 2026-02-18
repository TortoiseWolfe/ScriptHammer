# Code Review Findings - TODO

Tracking file for critical and important issues from full codebase review.
Delete this file once all items are resolved.

## CRITICAL (Must Fix)

- [x] **C-1** Hardcoded nil UUID in offline payment queue - FIXED
  - Store userId in QueuedOperation, pass from payment-service.ts, throw if missing

- [x] **C-2** Race condition in message sequence number - FIXED
  - Retry loop (3 attempts) on unique constraint violation (PostgreSQL 23505)

- [x] **C-3** Blog XSS via unsanitized HTML rendering - FIXED
  - Added sanitizeUrl() blocking javascript:/data:/vbscript: protocols
  - Added rel="noopener noreferrer" target="\_blank" on external links

- [x] **C-4** Rate limiting bypassable - FIXED
  - Changed fail-open to fail-closed (allowed:false, remaining:0)

## IMPORTANT (Should Fix - Future)

- [ ] **I-1** require() calls in ESM client components (SignInForm, SignUpForm)
- [ ] **I-2** Duplicate AccessibilityProvider implementations (dead code in components/)
- [ ] **I-3** CSP meta-tag missing Supabase, CartoDB, Web3Forms domains
- [ ] **I-4** OAuth UUID fallback uses Math.random() instead of crypto.getRandomValues()
- [ ] **I-5** 30+ TODO comments violate "No Technical Debt" principle
- [ ] **I-6** AuthContext useEffect missing signOut dependency
- [ ] **I-7** Email TLD validation uses ~30-item allowlist, rejects legitimate TLDs

## SUGGESTIONS (Nice to Have - Future)

- [ ] **S-1** SocialIcon.tsx does not follow 5-file component pattern
- [ ] **S-2** getClientIP() functions are no-ops (dead code)
- [ ] **S-3** Redundant location callbacks in map page
- [ ] **S-4** ConsentContext stale state capture
- [ ] **S-5** Markdown links missing rel="noopener noreferrer" in HTML path
- [ ] **S-6** AccessibilityContext dispatches StorageEvent to self
- [ ] **S-7** retryWithBackoff executes maxRetries+1 attempts (misleading name)
