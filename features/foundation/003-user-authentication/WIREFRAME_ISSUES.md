# Wireframe Issues: 003-user-authentication

## Summary
- **Files reviewed**: 5 SVGs
- **Issues found**: 12 total (0 critical, 5 major, 7 minor)
- **Pass**: 3
- **Reviewed on**: 2026-01-01

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 12 | - | 12 | 12 |
| 2 | 2026-01-01 | 9 | 3 | 0 | 9 |
| 3 | 2026-01-01 | 4 | 5 | 0 | 4 |

## Spec Requirements Extracted

### Functional Requirements (FR-001 to FR-033)
- **FR-001-005**: Account creation (email/password, validation, verification)
- **FR-006-011**: Authentication (sign-in, OAuth GitHub/Google, sign-out, password reset)
- **FR-012-015**: Session management (maintain, remember me, expiration, auto-refresh)
- **FR-016-019**: Security (rate limiting, protected routes, unverified redirect, RLS)
- **FR-020-023**: Authorization (own data only, derived user ID, transaction tracking)
- **FR-024-030**: Profile management (view, update, change password, delete, sessions)
- **FR-031-033**: Observability (logging, no passwords logged, audit retention)

### Success Criteria (SC-001 to SC-008)
- SC-001: Registration flow <3 minutes
- SC-002: Sign-in <2 seconds
- SC-003: 1,000 concurrent sessions
- SC-004: Zero unauthorized access
- SC-005: Password reset <2 minutes
- SC-006: OAuth <10 seconds
- SC-007: Logging latency <1 second
- SC-008: 100% expired session redirects

## Issues by File

### 01-login-signup.svg ✅ PASS

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Touch Target | Major | 🔴 | ✅ RESOLVED | Desktop signup OAuth buttons | OAuth buttons now 44px height | Fixed in regeneration |
| 2 | Touch Target | Major | 🔴 | ✅ RESOLVED | Desktop signup input fields | Input fields now 44px height | Fixed in regeneration |
| 3 | Spacing | Minor | 🔴 | ✅ RESOLVED | Mobile section transform | Mobile phone now at x=980 | Fixed in regeneration |

**Pass 3 Verification**: All 3 issues confirmed resolved. File passes review.

---

### 02-password-reset.svg ✅ PASS

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 4 | Spec Compliance | Minor | 🟢 | ✅ RESOLVED | Success state inset | SC-005 (<2 min completion) annotated | Fixed in Pass 1 |
| 5 | Touch Target | Minor | 🔴 | ✅ RESOLVED | Step 1 & 3 buttons | Buttons now 44px height | Fixed in regeneration |

**Pass 3 Verification**: All issues confirmed resolved. File passes review.

---

### 03-email-verification.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 6 | Touch Target | Minor | 🔴 | Pass 1 | "Resend Verification Email" button (line 76) | Button height is 40px, should be 44px | Change height from 40 to 44 |
| 7 | Alignment | Minor | 🟢 | ✅ RESOLVED | Mobile phone frame | Phone width 340px (acceptable variation) | N/A - accepted |

**Pass 3 Assessment**: 1 remaining issue - resend button touch target.

---

### 04-profile-settings.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 8 | Touch Target | Major | 🔴 | Pass 1 | Sidebar nav items (lines 68, 71, 74, 77, 83, 87) | Nav items are 40px height, should be 44px | Increase all nav item heights from 40 to 44 |
| 9 | Touch Target | Major | 🔴 | Pass 1 | Upload/Remove buttons (lines 102, 104) | Buttons are 32px height, should be 44px | Increase button heights from 32 to 44 |
| 10 | Spacing | Minor | 🔴 | Pass 1 | Sessions panel "Revoke" links (lines 158, 166) | "Revoke" text links need proper touch target area | Add 44×24 tap target rect behind each "Revoke" text |

**Pass 3 Assessment**: All 3 issues remain. Regeneration still required.

---

### 05-auth-flow-architecture.svg ✅ PASS

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 11 | Content | Minor | 🟢 | ✅ RESOLVED | Password Reset box (line 120) | Text now shows "Pwd Reset" on single line | N/A |
| 12 | Spec Compliance | Minor | 🟢 | ✅ RESOLVED | Email verification flow (lines 197-200) | FR-004/FR-005 now shown with dashed arrow | N/A |

**Pass 3 Verification**: All issues confirmed resolved. File passes review.

---

## Regeneration Feedback

### 03-email-verification.svg

#### Diagnosis
"Resend Verification Email" button in pending state is 40px (line 76).

#### Root Cause
Minor touch target sizing inconsistency not caught in previous regeneration.

#### Suggested Layout
- Change resend button height from 40 to 44
- Adjust card height or internal spacing to accommodate

#### Spec Requirements to Preserve
- FR-004: Verification email on signup
- FR-005: 24-hour expiration
- FR-018: Block unverified from payments

---

### 04-profile-settings.svg

#### Diagnosis
1. Sidebar nav items are all 40px height (lines 68, 71, 74, 77, 83, 87)
2. Avatar Upload/Remove buttons are 32px height (lines 102, 104)
3. "Revoke" links in sessions panel have no tap target area

#### Root Cause
Design used 40px for nav items and 32px for secondary actions, but AAA compliance requires 44px for all interactive elements.

#### Suggested Layout
- Sidebar: Increase all nav items from 40px to 44px (6 items × 4px = 24px more total height)
- Avatar buttons: Increase from 32px to 44px
- Sessions: Add invisible 44×24 rect behind each "Revoke" text
- May need to adjust sidebar height or reduce padding

#### Spec Requirements to Preserve
- FR-024-030: All profile management features
- FR-029, FR-030: Session viewing and revocation

---

## Classification Summary

| File | 🟢 Patchable | 🔴 Regenerate | Status |
|------|-------------|---------------|--------|
| 01-login-signup.svg | 0 | 0 | ✅ PASS |
| 02-password-reset.svg | 0 | 0 | ✅ PASS |
| 03-email-verification.svg | 0 | 1 | REGENERATE |
| 04-profile-settings.svg | 0 | 3 | REGENERATE |
| 05-auth-flow-architecture.svg | 0 | 0 | ✅ PASS |

## Pass 3 Summary

```
Pass 3 Complete:
- Issues from Pass 2: 9
- Resolved this pass: 5
- Still remaining: 4
- NEW issues found: 0
- Total remaining: 4

Files resolved: 3 (01, 02, 05)
Files needing work: 2 (03, 04)
```

## Next Steps

Run `/wireframe 003-user-authentication` to:
1. **SKIP** 01-login-signup.svg (all issues resolved)
2. **SKIP** 02-password-reset.svg (all issues resolved)
3. **REGENERATE** 03-email-verification.svg (1 touch target fix)
4. **REGENERATE** 04-profile-settings.svg (3 touch target fixes)
5. **SKIP** 05-auth-flow-architecture.svg (all issues resolved)
