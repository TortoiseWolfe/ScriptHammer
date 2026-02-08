# Wireframe Review Plan

Rigorous visual quality review of all SVG wireframes. Every issue found gets fixed.

**Command**: `/wireframe-review`

---

## Progress Tracker

| Batch | Features                | SVGs | Reviewed | Fixed | Status      |
| ----- | ----------------------- | ---- | -------- | ----- | ----------- |
| 1     | Foundation (000-006)    | 22   | 2/7      | 2/7   | In Progress |
| 2     | Core Features (007-012) | 21   | 0/6      | 0/6   | Not Started |
| 3     | Auth OAuth (013-016)    | 9    | 0/4      | 0/4   | Not Started |
| 4     | Enhancements (017-021)  | 12   | 0/5      | 0/5   | Not Started |
| 5     | Integrations (022-026)  | 16   | 0/5      | 0/5   | Not Started |
| 6     | Polish (027-030)        | 12   | 0/4      | 0/4   | Not Started |
| 7     | Testing (031-037)       | 14   | 0/7      | 0/7   | Not Started |
| 8     | Payments (038-043)      | 17   | 0/6      | 0/6   | Not Started |
| 9     | Code Quality (044-045)  | 6    | 0/2      | 0/2   | Not Started |

**Totals**: 129 SVGs | 2/46 features reviewed | 2/46 features complete

---

## Current Status

### Batch 1 - Foundation (000-006)

- **Reviewed**: 2/7 complete
- **000-rls-implementation**: ✅ Pass 3 - All issues resolved
- **001-wcag-aa-compliance**: ✅ All issues resolved
- **Next**: `/wireframe-review 002` to continue

---

## Workflow

```
/wireframe-review [feature]     # Review → find issues → classify 🟢/🔴
    ↓
WIREFRAME_ISSUES.md created:
  - Every issue logged
  - Every issue classified 🟢 or 🔴
  - No exceptions, no "acceptable as-is"
    ↓
/wireframe-fix [feature]        # Fix 🟢 issues, skip files with 🔴
    ↓
/wireframe [feature]            # Regenerate 🔴 files with feedback
    ↓
Mark feature complete when ALL issues fixed
```

### Classification Rules

**🟢 PATCHABLE** (4 things only):

- Missing CSS class definition
- Wrong color hex value
- Font size too small
- Typo in visible text

**🔴 REGENERATE** (everything else):

- Layout overlap/collision
- Spacing issues
- Element positioning
- Canvas size changes
- Missing content/rows
- Touch target sizing

**If ANY issue in a file is 🔴 → skip the ENTIRE file, regenerate it.**

### No Exceptions

If the review finds it, it gets fixed. Period.

- No "acceptable as-is"
- No "deferred"
- No discretion

---

## Feature List by Batch

### Batch 1 - Foundation (000-006) — 22 SVGs

| Feature                      | SVGs | Reviewed | Fixed  |
| ---------------------------- | ---- | -------- | ------ |
| 000-rls-implementation       | 3    | ✅ Yes   | ✅ Yes |
| 001-wcag-aa-compliance       | 3    | ✅ Yes   | ✅ Yes |
| 002-cookie-consent           | 2    | No       | -      |
| 003-user-authentication      | 5    | No       | -      |
| 004-mobile-first-design      | 4    | No       | -      |
| 005-security-hardening       | 2    | No       | -      |
| 006-template-fork-experience | 3    | No       | -      |

### Batch 2 - Core Features (007-012) — 21 SVGs

| Feature                          | SVGs | Reviewed | Fixed |
| -------------------------------- | ---- | -------- | ----- |
| 007-e2e-testing-framework        | 2    | No       | -     |
| 008-on-the-account               | 3    | No       | -     |
| 009-user-messaging-system        | 4    | No       | -     |
| 010-unified-blog-content         | 5    | No       | -     |
| 011-group-chats                  | 4    | No       | -     |
| 012-welcome-message-architecture | 3    | No       | -     |

### Batch 3 - Auth OAuth (013-016) — 9 SVGs

| Feature                      | SVGs | Reviewed | Fixed |
| ---------------------------- | ---- | -------- | ----- |
| 013-oauth-messaging-password | 2    | No       | -     |
| 014-admin-welcome-email-gate | 2    | No       | -     |
| 015-oauth-display-name       | 2    | No       | -     |
| 016-messaging-critical-fixes | 3    | No       | -     |

### Batch 4 - Enhancements (017-021) — 12 SVGs

| Feature                 | SVGs | Reviewed | Fixed |
| ----------------------- | ---- | -------- | ----- |
| 017-colorblind-mode     | 2    | No       | -     |
| 018-font-switcher       | 2    | No       | -     |
| 019-google-analytics    | 2    | No       | -     |
| 020-pwa-background-sync | 3    | No       | -     |
| 021-geolocation-map     | 3    | No       | -     |

### Batch 5 - Integrations (022-026) — 16 SVGs

| Feature                       | SVGs | Reviewed | Fixed |
| ----------------------------- | ---- | -------- | ----- |
| 022-web3forms-integration     | 3    | No       | -     |
| 023-emailjs-integration       | 2    | No       | -     |
| 024-payment-integration       | 4    | No       | -     |
| 025-blog-social-features      | 3    | No       | -     |
| 026-unified-messaging-sidebar | 4    | No       | -     |

### Batch 6 - Polish (027-030) — 12 SVGs

| Feature                     | SVGs | Reviewed | Fixed |
| --------------------------- | ---- | -------- | ----- |
| 027-ux-polish               | 2    | No       | -     |
| 028-enhanced-geolocation    | 2    | No       | -     |
| 029-seo-editorial-assistant | 4    | No       | -     |
| 030-calendar-integration    | 4    | No       | -     |

### Batch 7 - Testing (031-037) — 14 SVGs

| Feature                     | SVGs | Reviewed | Fixed |
| --------------------------- | ---- | -------- | ----- |
| 031-standardize-test-users  | 2    | No       | -     |
| 032-signup-e2e-tests        | 2    | No       | -     |
| 033-seo-library-tests       | 2    | No       | -     |
| 034-blog-library-tests      | 2    | No       | -     |
| 035-messaging-service-tests | 2    | No       | -     |
| 036-auth-component-tests    | 2    | No       | -     |
| 037-game-a11y-tests         | 2    | No       | -     |

### Batch 8 - Payments (038-043) — 17 SVGs

| Feature                   | SVGs | Reviewed | Fixed |
| ------------------------- | ---- | -------- | ----- |
| 038-payment-dashboard     | 3    | No       | -     |
| 039-payment-offline-queue | 3    | No       | -     |
| 040-payment-retry-ui      | 3    | No       | -     |
| 041-paypal-subscriptions  | 3    | No       | -     |
| 042-payment-rls-policies  | 3    | No       | -     |
| 043-group-service         | 2    | No       | -     |

### Batch 9 - Code Quality (044-045) — 6 SVGs

| Feature                        | SVGs | Reviewed | Fixed |
| ------------------------------ | ---- | -------- | ----- |
| 044-error-handler-integrations | 3    | No       | -     |
| 045-disqus-theme               | 3    | No       | -     |

---

## Usage

```bash
# Review single feature
/wireframe-review 000

# Review batch
/wireframe-review batch 1

# Fix patchable issues
/wireframe-fix 000

# Regenerate files with structural issues
/wireframe 000
```

---

## Review Log

| Date       | Feature                | Action              | Result                             |
| ---------- | ---------------------- | ------------------- | ---------------------------------- |
| 2026-01-01 | 000-rls-implementation | Review + Regenerate | ✅ Pass 3 - All 16 issues resolved |
| 2026-01-01 | 001-wcag-aa-compliance | Review + Fix/Regen  | ✅ All 14 issues resolved          |

---

## Lessons Learned

### 004-mobile-first-design Patching Failure

Attempted to patch structural issues (overlap, cramped layout) by:

- Extending canvas 1400→1600px
- Rearranging elements
- Moving panels

**Result**: Made things WORSE. New overlaps, wasted space, more issues than before.

**Lesson**: Structural issues = regenerate. Only patch color/font/typo.

### The "Deferred" Antipattern

Original workflow allowed issues to be marked "acceptable as-is" or "deferred."

**Result**: Structural issues got swept under the rug while cosmetic patches were applied. When regeneration finally happened, patches were lost.

**Lesson**: No exceptions. Find it → fix it. 🟢 or 🔴, nothing else.
