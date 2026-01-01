# Wireframe Issues: 003-user-authentication

## Summary
- **Files reviewed**: 5 SVGs
- **Issues found**: 12 total (0 critical, 5 major, 7 minor)
- **Pass**: 1
- **Reviewed on**: 2026-01-01

## Review History
| Pass | Date | Found | Resolved | New | Remaining |
|------|------|-------|----------|-----|-----------|
| 1 | 2026-01-01 | 12 | - | 12 | 12 |

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

### 01-login-signup.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 1 | Touch Target | Major | 🔴 | Pass 1 | Desktop signup OAuth buttons (y=535) | OAuth buttons are 40px height instead of 44px minimum | Change height from 40 to 44, adjust y positions |
| 2 | Touch Target | Major | 🔴 | Pass 1 | Desktop signup input fields | Input fields are 40px height instead of 44px | Change all input heights from 40 to 44 |
| 3 | Spacing | Minor | 🔴 | Pass 1 | Mobile section label (x=940) | Mobile phone starts at x=940 but standard layout expects x=980 | Shift phone frame to x=980 for consistency |

**Overall Assessment**: Login form is well-designed with proper touch targets (44px buttons). Signup form has smaller input fields (40px) that should be 44px for AAA touch target compliance. Mobile view is comprehensive.

---

### 02-password-reset.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 4 | Spec Compliance | Minor | 🟢 | Pass 1 | Success state inset | SC-005 (<2 min completion) not annotated in success state | Add "SC-005" annotation to success banner |
| 5 | Touch Target | Minor | 🔴 | Pass 1 | Step 1 & 2 buttons | Buttons are 40px height, should be 44px | Change button heights from 40 to 44 |

**Overall Assessment**: Excellent 3-step flow visualization. Expired state shown in mobile view addresses edge case. Flow arrows clearly indicate progression. Minor touch target adjustments needed.

---

### 03-email-verification.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 6 | Touch Target | Minor | 🔴 | Pass 1 | "Resend Verification Email" button (y=335) | Button height is 40px, should be 44px | Change height from 40 to 44 |
| 7 | Alignment | Minor | 🟢 | Pass 1 | Mobile phone frame | Phone width is 340px instead of standard 360px | Keep as-is (minor variation acceptable) or adjust to 360px |

**Overall Assessment**: All three verification states (pending, success, expired) are clearly visualized. Mobile view correctly shows unverified user blocking scenario (User Story 7). FR-005 and FR-018 properly annotated.

---

### 04-profile-settings.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 8 | Touch Target | Major | 🔴 | Pass 1 | Sidebar nav items (160-310) | Nav items are 40px height, should be 44px | Increase all nav item heights from 40 to 44 |
| 9 | Touch Target | Major | 🔴 | Pass 1 | Upload/Remove buttons (y=120) | Buttons are 32px height, should be 44px | Increase button heights from 32 to 44 |
| 10 | Spacing | Minor | 🔴 | Pass 1 | Sessions panel layout | "Revoke" text links need proper touch target area, not just text | Wrap "Revoke" in a 44x24 tap target rect |

**Overall Assessment**: Comprehensive profile and sessions view. Shows FR-024-030 well. Delete account flow in mobile shows FR-027/FR-028 cascade delete. Touch targets need adjustment for AAA compliance.

---

### 05-auth-flow-architecture.svg

| # | Category | Severity | Classification | Status | Location | Description | Suggested Fix |
|---|----------|----------|----------------|--------|----------|-------------|---------------|
| 11 | Content | Minor | 🟢 | Pass 1 | Password Reset box (y=50) | Text "Password" and "Reset" are on separate lines, breaking the label | Combine into single line "Pwd Reset" or expand box width |
| 12 | Spec Compliance | Minor | 🟢 | Pass 1 | Email verification not shown | FR-004 (verification email) and FR-005 (24hr expiration) not in flow diagram | Add email verification step in Client → Auth flow |

**Overall Assessment**: Excellent architecture diagram showing all major components, token lifecycle, and route protection logic. OAuth flow, session management, and success criteria are all visualized. Minor content and spec coverage improvements needed.

---

## Regeneration Feedback

### 01-login-signup.svg

#### Diagnosis
1. Desktop Signup section has input fields with 40px height (lines 122, 126, 131, 135) instead of 44px
2. OAuth buttons in signup are 40px (lines 151, 154) instead of 44px
3. Mobile phone positioned at x=940 (line 164) instead of standard x=980

#### Root Cause
Touch target sizing not consistently applied to signup form - login form has correct 44px buttons but signup uses 40px fields/buttons.

#### Suggested Layout
- Keep login card as-is (correct sizing)
- Update signup card input heights: 40→44
- Update signup OAuth button heights: 40→44
- Shift mobile phone transform from `translate(940, 60)` to `translate(980, 60)`
- Adjust y-positions to maintain spacing after height increases

#### Spec Requirements to Preserve
- FR-001-005: Account creation with all fields
- FR-007, FR-008: OAuth buttons for GitHub/Google
- FR-003: Password requirements annotation
- FR-016: Lockout annotation

---

### 02-password-reset.svg

#### Diagnosis
Step 1 "Send Reset Link" button is 40px (line 78), Step 3 "Reset Password" button is 40px (line 145).

#### Root Cause
Inconsistent button heights across the 3-step flow cards.

#### Suggested Layout
- Step 1: Change button height from 40 to 44 (line 78)
- Step 2: (no button, just informational - OK)
- Step 3: Change button height from 40 to 44 (line 145)
- Adjust card heights or internal spacing to accommodate

#### Spec Requirements to Preserve
- FR-010, FR-011: Password reset with 1-hour expiration
- SC-005: Under 2 minutes completion time

---

### 03-email-verification.svg

#### Diagnosis
"Resend Verification Email" button in pending state is 40px (line 76).

#### Root Cause
Minor touch target sizing inconsistency.

#### Suggested Layout
- Change resend button height from 40 to 44
- Adjust card height or internal spacing

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

| File | 🟢 Patchable | 🔴 Regenerate | Action |
|------|-------------|---------------|--------|
| 01-login-signup.svg | 0 | 3 | REGENERATE |
| 02-password-reset.svg | 1 | 1 | REGENERATE |
| 03-email-verification.svg | 1 | 1 | REGENERATE |
| 04-profile-settings.svg | 0 | 3 | REGENERATE |
| 05-auth-flow-architecture.svg | 3 | 0 | PATCH |

## Next Steps

Run `/wireframe 003-user-authentication` to:
1. **REGENERATE** 01-login-signup.svg (touch target fixes for signup form)
2. **REGENERATE** 02-password-reset.svg (button height fixes)
3. **REGENERATE** 03-email-verification.svg (button height fix)
4. **REGENERATE** 04-profile-settings.svg (nav and button height fixes)
5. **PATCH** 05-auth-flow-architecture.svg (3 minor annotation/text fixes)
