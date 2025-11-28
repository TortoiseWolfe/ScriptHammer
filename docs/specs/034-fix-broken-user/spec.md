# Feature Specification: Fix User Profile System

**Feature Branch**: `034-fix-broken-user`
**Created**: 2025-11-25
**Status**: Draft
**Input**: User description: "Fix broken user profile system where: 1) Profile changes don't persist - AccountSettings writes to auth.users.user_metadata but search queries user_profiles table (no sync), 2) Users can't find each other - user_profiles.username and display_name fields are empty/NULL, 3) UI only has Username field - needs Display Name field too, 4) UI text misleading - says email or username but email search doesn't work. Solution: AccountSettings should write directly to user_profiles table instead of auth.users.user_metadata. Add display_name field to UI. Fix search text to say username or name."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Update Profile Settings (Priority: P1)

As a user, I want to update my username and display name in Account Settings and have those changes actually persist so that other users can find me and see my preferred name.

**Why this priority**: This is the core bug - profile changes don't save to the right table, making the entire profile system broken. Without this fix, all other features are useless.

**Independent Test**: Can be fully tested by logging in, updating username/display_name in Account Settings, refreshing the page, and verifying the values persist. Delivers immediate value by fixing the save functionality.

**Acceptance Scenarios**:

1. **Given** a logged-in user on Account Settings page, **When** they enter a username and click "Update Profile", **Then** the username is saved to user_profiles table and persists after page refresh
2. **Given** a logged-in user on Account Settings page, **When** they enter a display name and click "Update Profile", **Then** the display_name is saved to user_profiles table and shown in their profile
3. **Given** a logged-in user with existing profile data, **When** they visit Account Settings, **Then** the form is pre-populated with their current username and display_name from user_profiles table

---

### User Story 2 - Search and Find Users (Priority: P2)

As a user, I want to search for other users by their username or display name so that I can send them friend requests and start conversations.

**Why this priority**: Once profiles save correctly (P1), users need to be able to find each other. This enables the social/messaging features.

**Independent Test**: Can be fully tested by having two users with set usernames/display_names, then User A searches for User B by partial username or name and finds them in results.

**Acceptance Scenarios**:

1. **Given** a user "alice" with display_name "Alice Smith", **When** another user searches "alice", **Then** the search results include alice's profile
2. **Given** a user "alice" with display_name "Alice Smith", **When** another user searches "Smith", **Then** the search results include alice's profile (partial display_name match)
3. **Given** multiple users exist, **When** a user searches with a query matching multiple profiles, **Then** all matching profiles appear in results

---

### User Story 3 - Clear Search UI Labels (Priority: P3)

As a user, I want the search UI to clearly indicate what I can search by (username or name) so I don't waste time trying to search by email which doesn't work.

**Why this priority**: UX improvement that removes confusion. Lower priority because the core functionality (P1, P2) must work first.

**Independent Test**: Can be tested by viewing the UserSearch component and verifying labels say "username or name" instead of "email or username".

**Acceptance Scenarios**:

1. **Given** a user viewing the Find Users / Add Friend interface, **When** they see the search label, **Then** it reads "Search for users by username or name"
2. **Given** a user on the search interface, **When** they see the placeholder text, **Then** it reads "Enter username or name"
3. **Given** a search returns no results, **When** the error message displays, **Then** it reads "No users found matching your search"

---

### Edge Cases

- What happens when a user tries to set a username that already exists? (Should show uniqueness error)
- What happens when username is empty but display_name is set? (Should allow - username is optional per schema)
- What happens when username exceeds 30 characters or is less than 3? (Should show validation error)
- How does system handle special characters in display_name? (Should allow - up to 100 chars per schema)
- What if user_profiles row doesn't exist yet? (Should be created on signup via trigger, but handle gracefully)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST save username and display_name to user_profiles table (not auth.users.user_metadata)
- **FR-002**: System MUST load existing profile data from user_profiles table when Account Settings loads
- **FR-003**: System MUST provide a Display Name input field in Account Settings UI
- **FR-004**: System MUST validate username: 3-30 characters, unique across all users
- **FR-005**: System MUST validate display_name: maximum 100 characters
- **FR-006**: System MUST search user_profiles by username (partial, case-insensitive)
- **FR-007**: System MUST search user_profiles by display_name (partial, case-insensitive)
- **FR-008**: System MUST display accurate search UI labels ("username or name", not "email or username")
- **FR-009**: System MUST show helpful error messages for validation failures

### Key Entities

- **user_profiles**: Public profile data for users (id, username, display_name, avatar_url, bio, created_at, updated_at). Source of truth for searchable/displayable user info.
- **auth.users**: Supabase managed auth table. Contains user_metadata which should NOT be used for public profile data.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Profile changes persist across page refresh (0% data loss after save)
- **SC-002**: Users can be found by partial username match within 3 characters of query
- **SC-003**: Users can be found by partial display_name match within 3 characters of query
- **SC-004**: No UI text references "email" search capability
- **SC-005**: Username uniqueness enforced at both database and application level
- **SC-006**: 100% of existing profile display continues to work (no regression)
