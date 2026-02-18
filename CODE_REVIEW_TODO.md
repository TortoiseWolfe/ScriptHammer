# Code Review Findings - ALL RESOLVED

All items from the full codebase review have been resolved.
This file can be deleted.

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

## IMPORTANT (Should Fix)

- [x] **I-1** require() calls in ESM client components - FIXED
  - Replaced require() with dynamic import() in SignInForm and SignUpForm

- [x] **I-2** Duplicate AccessibilityProvider implementations - FIXED
  - Deleted dead src/components/AccessibilityProvider.tsx (only contexts/ version is used)

- [x] **I-3** CSP meta-tag missing domains - FIXED
  - Added Supabase, CartoDB, Web3Forms to connect-src in layout.tsx

- [x] **I-4** OAuth UUID fallback uses Math.random() - FIXED
  - Replaced with crypto.getRandomValues() in oauth-state.ts

- [x] **I-5** 30+ TODO comments - FIXED
  - Removed all 27 TODO comments from src/ (test files, source files, service stubs)

- [x] **I-6** AuthContext signOut not memoized - FIXED
  - Wrapped signOut in useCallback

- [x] **I-7** Email TLD validation allowlist - FIXED
  - Replaced ~30-item TLD allowlist with tld.length >= 2 check

## SUGGESTIONS (Nice to Have)

- [x] **S-1** SocialIcon.tsx 5-file pattern - FIXED
  - Converted to SocialIcon/ directory with index, test, stories, a11y test

- [x] **S-2** getClientIP() dead code - FIXED
  - Removed no-op functions from audit-logger.ts and rate-limit-check.ts

- [x] **S-3** Redundant location callbacks - FIXED
  - Removed handleLocationFound/handleLocationError from map page (redundant with useEffect on position)

- [x] **S-4** ConsentContext stale state - FIXED
  - Changed acceptAll/rejectAll/savePreferences to use functional updater pattern

- [x] **S-5** Markdown links missing rel attributes - FIXED (done in C-3)

- [x] **S-6** AccessibilityContext self-dispatching StorageEvent - FIXED
  - Removed unnecessary window.dispatchEvent(StorageEvent) call

- [x] **S-7** retryWithBackoff misleading naming - FIXED
  - Renamed maxRetries to maxAttempts, fixed loop bound to run exactly maxAttempts times
