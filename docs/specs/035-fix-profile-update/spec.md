# Feature Specification: Fix Profile Update Silent Failure

**Feature Branch**: `035-fix-profile-update`
**Created**: 2025-11-25
**Status**: Draft
**Input**: User description: "Fix profile update silent failure: clicking 'Update Profile' button has no effect. Root cause: Supabase .update() returns error:null even when 0 rows are updated (row doesn't exist or RLS blocks). Code only checks for error, not whether data was actually modified. Fix: use .upsert() with onConflict:'id' and validate returned data exists. Also fix username case mismatch (validation checks lowercase, save uses original case)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Profile Update Persists (Priority: P1)

As a user, I want to update my display name and username in Account Settings and have those changes actually persist to the database, so that other users can find me and see my correct name.

**Why this priority**: This is the core bug - users cannot update their profiles at all. Without this fix, the entire profile system is broken.

**Independent Test**: User changes display name from "John" to "John Doe", clicks Update Profile, refreshes page, sees "John Doe" persisted.

**Acceptance Scenarios**:

1. **Given** a signed-in user on Account Settings, **When** they change display_name and click "Update Profile", **Then** the change persists after page refresh
2. **Given** a signed-in user whose user_profiles row doesn't exist, **When** they update their profile, **Then** the row is created (upsert) and values persist
3. **Given** a signed-in user, **When** the update succeeds, **Then** they see "Settings updated successfully!" message

---

### User Story 2 - Username Case Consistency (Priority: P2)

As a user, I want usernames to be case-insensitive so that "JohnDoe" and "johndoe" are treated as the same username, preventing duplicate usernames with different cases.

**Why this priority**: Important for user discovery and preventing confusion, but secondary to fixing the core persistence bug.

**Independent Test**: User tries to save username "JohnDoe" when "johndoe" already exists - should show "username taken" error.

**Acceptance Scenarios**:

1. **Given** a user with username "johndoe" exists, **When** another user tries to save username "JohnDoe", **Then** they see "This username is already taken" error
2. **Given** a user saves username "JohnDoe", **When** the data is saved, **Then** it is stored as "johndoe" (lowercase normalized)

---

### User Story 3 - Clear Success/Error Feedback (Priority: P3)

As a user, I want clear feedback when my profile update succeeds or fails, so I know whether to try again or if my changes are saved.

**Why this priority**: UX improvement - the current success message doesn't auto-dismiss and may scroll out of view.

**Independent Test**: User updates profile successfully, sees green success toast that auto-dismisses after 3 seconds.

**Acceptance Scenarios**:

1. **Given** a successful profile update, **When** success message appears, **Then** it auto-dismisses after 3 seconds
2. **Given** a failed profile update (e.g., duplicate username), **When** error message appears, **Then** user clearly sees what went wrong

---

### Edge Cases

- What happens when user_profiles row doesn't exist for an authenticated user? → Upsert creates it
- What happens when RLS policy blocks the update silently? → Check returned data, show error if null
- What happens when username contains uppercase letters? → Normalize to lowercase before save
- What happens when the database is unreachable? → Show error message from Supabase
- What happens with concurrent profile updates from multiple tabs? → Last write wins (PostgreSQL default); no special handling needed for single-user profile
- What happens when fields contain only whitespace? → Treat as null (trim then check if empty)
- What happens at field length boundaries? → Existing validation enforces: username 3-30, display_name ≤100, bio ≤500
- What happens on network timeout during save? → Show generic error "Failed to update profile. Please try again."

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST use `.upsert()` with `onConflict: 'id'` instead of `.update()` to handle missing rows
- **FR-002**: System MUST call `.select().single()` after upsert to verify data was actually saved
- **FR-003**: System MUST check that returned data exists, not just that error is null
- **FR-004**: System MUST normalize username to lowercase before saving
- **FR-005**: System MUST auto-dismiss success message after 3 seconds
- **FR-006**: System MUST show clear error message if update fails silently (data is null)
- **FR-007**: System MUST show loading spinner on "Update Profile" button during save operation
- **FR-008**: System MUST disable form inputs while save is in progress to prevent concurrent edits
- **FR-009**: Success/error messages MUST appear at bottom of Profile Settings card (existing alert position)
- **FR-010**: System MUST refetch profile data after successful save to ensure UI reflects database state

### Key Entities

- **user_profiles**: Contains username (TEXT UNIQUE, lowercase), display_name (TEXT), bio (TEXT), avatar_url (TEXT)
- **Relationship**: user_profiles.id references auth.users(id) with CASCADE delete

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Profile changes persist after page refresh 100% of the time when update succeeds
- **SC-002**: Success message auto-dismisses within 3 seconds
- **SC-003**: Users with missing user_profiles rows can still update their profile (upsert creates row)
- **SC-004**: Duplicate username attempts (case-insensitive) are rejected with clear error message
