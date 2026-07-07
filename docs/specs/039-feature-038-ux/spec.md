# Feature Specification: UX Polish

**Feature Branch**: `039-feature-038-ux`
**Created**: 2025-11-26
**Status**: Draft
**Input**: User description: "Feature 038: UX Polish - Fix four UX issues discovered during manual testing: (1) Avatar not updating in navbar after change - requires page refresh, (2) Password validation messages appear at bottom of page, far from input fields, (3) Password update doesn't work at all, (4) Find People tab missing from UnifiedSidebar"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Avatar Updates Reactively (Priority: P1)

As a user who updates their profile picture, I want to see my new avatar reflected in the navigation bar immediately without having to refresh the page.

**Why this priority**: This is the most impactful bug - users think their avatar upload failed when it actually succeeded. Causes confusion and potential duplicate uploads.

**Independent Test**: Upload a new avatar image, verify the navbar avatar updates within 1 second without page refresh.

**Acceptance Scenarios**:

1. **Given** user is logged in and viewing Account Settings, **When** user uploads a new avatar image successfully, **Then** the navbar avatar updates immediately to show the new image
2. **Given** user is logged in and viewing Account Settings, **When** user removes their avatar, **Then** the navbar shows the default avatar placeholder immediately
3. **Given** user has the navbar visible, **When** avatar upload completes in AccountSettings, **Then** no page refresh is required to see the updated avatar

---

### User Story 2 - Inline Password Validation (Priority: P1)

As a user changing my password, I want to see validation feedback near the password input field so I understand what's wrong without scrolling.

**Why this priority**: Critical UX issue - users miss validation messages entirely, leading to frustration and abandoned password changes.

**Independent Test**: Enter invalid password in the Change Password form, verify error message appears directly below the input field, not at page bottom.

**Acceptance Scenarios**:

1. **Given** user is on Account Settings page viewing the Change Password form, **When** user submits an invalid password, **Then** the error message appears immediately below the password input field
2. **Given** user is on Account Settings page, **When** user successfully changes their password, **Then** the success message appears within the Change Password card
3. **Given** user has scrolled to the Change Password section, **When** validation fails, **Then** user does not need to scroll to see the error message

---

### User Story 3 - Password Update Functionality (Priority: P1)

As a user who wants to change my password, I need the password update feature to actually work and save my new password.

**Why this priority**: Critical bug - password update is completely broken, users cannot change their passwords at all.

**Independent Test**: Enter valid new password and confirmation, submit form, verify password is actually changed (can log in with new password).

**Acceptance Scenarios**:

1. **Given** user is on Account Settings page, **When** user enters a valid new password and confirmation and submits, **Then** the password is successfully updated
2. **Given** user has changed their password, **When** user logs out and logs back in, **Then** the new password works
3. **Given** user submits password change, **When** the change succeeds, **Then** user sees a success message within the Change Password card

---

### User Story 4 - Find People Tab Visible (Priority: P1)

As a user who wants to discover new people to connect with, I need to see the Find People tab in the messaging sidebar so I can search for users.

**Why this priority**: Critical bug - the Find People tab is not appearing in the UnifiedSidebar, making the feature inaccessible.

**Independent Test**: Navigate to /messages, verify 3 tabs are visible: Chats, Connections, Find People.

**Acceptance Scenarios**:

1. **Given** user is logged in and navigates to /messages, **When** the page loads, **Then** user sees 3 tabs: Chats, Connections, Find People
2. **Given** user clicks on the Find People tab, **When** the tab activates, **Then** UserSearch component is rendered
3. **Given** user is on mobile, **When** user opens the sidebar drawer, **Then** all 3 tabs are visible and functional

---

### Edge Cases

- What happens when avatar upload fails? Error displays inline in Avatar Settings card with message "Failed to upload avatar. Please try again.", navbar avatar remains unchanged
- What happens when profile update and password update have errors simultaneously? Each form displays its own error independently within its respective card
- What happens when `refetchProfile()` fails silently? Navbar retains previous avatar (no UI change), console.error logged for debugging
- What happens when password update API call fails? Error displays inline in Change Password card with message; user can retry by resubmitting form
- What happens when UnifiedSidebar fails to render? React error boundary catches error, displays "Unable to load sidebar. Please refresh the page." message

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST call `refetchProfile()` after successful avatar upload to update navbar
- **FR-002**: System MUST call `refetchProfile()` after successful avatar removal to update navbar
- **FR-003**: AccountSettings MUST use separate error/success states for profile and password forms
- **FR-004**: Profile error/success messages MUST render within the Profile Settings card
- **FR-005**: Password error/success messages MUST render within the Change Password card
- **FR-006**: Bottom-of-page error/success alerts MUST be removed from AccountSettings
- **FR-007**: Password update MUST successfully call Supabase auth.updateUser() with new password
- **FR-008**: Password update MUST validate password requirements before API call (min 8 chars, uppercase, lowercase, number, special character per `src/lib/auth/password-validator.ts`)
- **FR-009**: Password update MUST show success confirmation when password is changed
- **FR-010**: UnifiedSidebar MUST render all 3 tabs: Chats, Connections, Find People
- **FR-011**: Find People tab MUST render UserSearch component when active
- **FR-012**: All 3 tabs MUST be visible on both desktop and mobile viewports

### Key Entities

- **UserProfile**: User profile data from `user_profiles` table, includes `avatar_url`
- **AuthContext**: React context providing user session and `refreshSession()` method
- **useUserProfile Hook**: Provides profile data and `refetch()` method for cache invalidation

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Avatar updates in GlobalNav within 1 second of successful upload (no page refresh needed) - verified via manual test
- **SC-002**: Password validation errors visible without scrolling when user is in Change Password section (viewport: 1024x768 desktop, 375x667 mobile)
- **SC-003**: Password update successfully changes password (verified by manual logout/login with new password)
- **SC-004**: All existing AccountSettings tests pass after refactoring - verify via `pnpm test AccountSettings`
- **SC-005**: Zero accessibility regressions - inline alerts must have `role="alert"` or `role="status"`, `aria-live="assertive"` (errors) or `aria-live="polite"` (success)
- **SC-006**: Find People tab visible and functional on /messages page (desktop: 1024px+, mobile: 375px drawer)

## Additional Requirements

### Timing & Behavior Requirements

- **FR-013**: Success messages MUST auto-dismiss after 3 seconds
- **FR-014**: Password fields MUST NOT be cleared after failed validation (user can correct and retry)
- **FR-015**: Rapid avatar upload/remove operations MUST be debounced - ignore new operation if one is in progress
- **FR-016**: Tab content MUST show loading spinner during async data fetch (if applicable)
- **FR-017**: Find People tab MUST be positioned third (after Chats, Connections) in tab order

### Alert Placement Requirements

- **FR-018**: Inline alerts MUST render after the submit button, before the card closing tag, with `mt-4` margin
- **FR-019**: Bottom-of-page alerts to remove are located at `AccountSettings.tsx:416-426` (error alert) and success alert
- **FR-020**: Success message content for password change: "Password changed successfully!"
- **FR-021**: Profile and password alert styling MUST be consistent: same DaisyUI alert classes (`alert-error`, `alert-success`)

### Network & Error Handling

- **FR-022**: Network instability during avatar upload: existing upload retry logic applies; show error on final failure
- **FR-023**: Password API timeout (>10s): show error "Request timed out. Please try again."
- **FR-024**: Tab switching during avatar upload: upload continues in background, result displays when user returns
- **FR-025**: UserSearch component load failure: show "Unable to load user search. Please try again." within tab panel
- **FR-026**: Session expiry during password change: redirect to login with message "Session expired. Please sign in again."

### Zero-State Scenarios

- **FR-027**: No avatar: display initials-based placeholder (existing AvatarDisplay behavior)
- **FR-028**: No connections: ConnectionManager shows "No connections yet" message (existing behavior)

## Accessibility Requirements

- **A11Y-001**: Focus MUST remain on the form that submitted after success/error message displays
- **A11Y-002**: Tab switching in UnifiedSidebar MUST be keyboard accessible (arrow keys navigate, Enter/Space activates)
- **A11Y-003**: Screen readers MUST announce success/error messages via ARIA live regions (already in SC-005)
- **A11Y-004**: Color contrast for alerts MUST meet WCAG AA (DaisyUI default alerts comply)
- **A11Y-005**: Tab order in AccountSettings: Profile form → Avatar section → Password form → Privacy section (natural DOM order)
- **A11Y-006**: Touch targets for any dismiss buttons MUST be minimum 44x44px (use `min-h-11 min-w-11`)

## State Management Requirements

- **STATE-001**: `refreshSession()` updates auth metadata (user.user_metadata); `refetchProfile()` re-fetches from user_profiles table
- **STATE-002**: Both MUST be called after avatar change: refreshSession for auth, refetchProfile for profile hook cache
- **STATE-003**: Profile form state is isolated from password form state - no shared error/success variables
- **STATE-004**: Cache invalidation: `refetchProfile()` forces fresh fetch from database, ignoring any cached data
- **STATE-005**: Loading states: each form tracks its own `loading` boolean independently
- **STATE-006**: Local form state (displayName, bio, password) syncs FROM useUserProfile on mount, then manages locally

## Technical Assumptions (Validated)

- **ASSUME-001**: Supabase `auth.updateUser({ password })` works correctly when called with valid session - validated in codebase
- **ASSUME-002**: Supabase Auth failure modes: returns `{ error }` object with `message` property - handled in existing code
- **ASSUME-003**: `useUserProfile` hook exists at `src/hooks/useUserProfile.ts` with `refetch()` method - validated in research.md
- **ASSUME-004**: Mobile viewport defined as width < 768px (md breakpoint) - uses DaisyUI drawer pattern

## Terminology Glossary

| Term         | Definition                                                             | Canonical Usage                                                          |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| GlobalNav    | The top navigation bar component at `src/components/GlobalNav.tsx`     | Use "GlobalNav" in code, "navbar" acceptable in user-facing text         |
| Avatar       | User profile picture stored in `user_profiles.avatar_url`              | Primary storage is `user_profiles` table, also synced to `user_metadata` |
| Inline Alert | Error/success message displayed within a form card, not at page bottom | Always "inline alert", never "toast" or "notification"                   |

## Root Cause Analysis

### Password Update Issue (US-3)

**Hypothesis**: Password update API call likely works, but error/success was invisible due to bottom-of-page alert placement. Users couldn't see validation errors, assumed feature was broken. Fixing US-2 (inline alerts) should reveal any actual API errors.

### Find People Tab Issue (US-4)

**Hypothesis**: Tab code exists in UnifiedSidebar.tsx (lines 87-94) but may be hidden due to CSS overflow or container width constraints. DevTools inspection required during implementation to confirm root cause.

## Traceability Matrix

| User Story               | Functional Requirements                                                        | Success Criteria       |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------- |
| US-1 (Avatar Updates)    | FR-001, FR-002, FR-015, FR-022                                                 | SC-001                 |
| US-2 (Inline Validation) | FR-003, FR-004, FR-005, FR-006, FR-013, FR-014, FR-018, FR-019, FR-020, FR-021 | SC-002, SC-004, SC-005 |
| US-3 (Password Update)   | FR-007, FR-008, FR-009, FR-023, FR-026                                         | SC-003                 |
| US-4 (Find People Tab)   | FR-010, FR-011, FR-012, FR-016, FR-017, FR-024, FR-025                         | SC-006                 |
