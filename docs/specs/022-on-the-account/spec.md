# Feature Specification: User Avatar Upload

**Feature Branch**: `022-on-the-account`
**Created**: 2025-10-08
**Status**: Draft
**Input**: User description: "on the Account Settings page, a user should be able to upload an avatar"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Upload New Avatar (Priority: P1)

A user visits their Account Settings page and wants to personalize their profile by uploading a profile picture.

**Why this priority**: Core MVP functionality - without the ability to upload an avatar, the feature doesn't exist. This is the fundamental user value proposition.

**Independent Test**: Can be fully tested by navigating to Account Settings, clicking upload button, selecting an image file, and verifying the avatar displays in the UI. Delivers immediate value of profile personalization.

**Acceptance Scenarios**:

1. **Given** user is logged in and on Account Settings page, **When** user clicks "Upload Avatar" button, **Then** file picker dialog opens
2. **Given** file picker is open, **When** user selects a valid image file (JPEG/PNG/WebP), **Then** crop interface displays with image preview
3. **Given** crop interface is showing, **When** user positions/frames the image and clicks "Save", **Then** cropped avatar is uploaded to storage and displays as user's profile picture
4. **Given** avatar upload succeeded, **When** user navigates away and returns, **Then** their avatar persists and displays correctly

---

### User Story 2 - Replace Existing Avatar (Priority: P2)

A user with an existing avatar wants to change it to a different image.

**Why this priority**: Natural follow-on to P1 - users will want to update avatars over time. Enhances the initial MVP.

**Independent Test**: Upload an initial avatar (P1), then upload a different image and verify the new one replaces the old one completely.

**Acceptance Scenarios**:

1. **Given** user already has an avatar set, **When** user uploads a new avatar, **Then** new avatar replaces the old one
2. **Given** new avatar was uploaded, **When** system completes upload, **Then** old avatar file is immediately deleted from storage to save costs

---

### User Story 3 - Remove Avatar (Priority: P3)

A user wants to remove their custom avatar and revert to a default state.

**Why this priority**: Less common use case but necessary for user control and privacy. Users should be able to remove personal images.

**Independent Test**: Upload an avatar, then use a "Remove Avatar" action and verify avatar is deleted and user sees default avatar or initials.

**Acceptance Scenarios**:

1. **Given** user has a custom avatar, **When** user clicks "Remove Avatar", **Then** system deletes the avatar file and reverts to default avatar
2. **Given** avatar was removed, **When** user views their profile elsewhere in app, **Then** default avatar displays consistently

---

### Edge Cases

- What happens when user uploads an **invalid file format** (PDF, GIF, TIFF)?
- What happens when user uploads a file **exceeding size limit** (e.g., 5MB)?
- What happens when file upload **fails mid-transfer** (network interruption)?
- What happens when user has **no avatar and never uploads one**?
- What happens when two users upload the **same filename simultaneously**?
- How does system handle **extremely small images** (< 200x200 pixels)?
- How does system handle **extremely large images** (10000x10000 pixels)?
- What happens when storage bucket **runs out of space**?
- What happens when user **closes crop interface without saving**?
- What happens when user tries to crop area **smaller than minimum dimensions** (200x200px)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide an "Upload Avatar" button/interface on the Account Settings page
- **FR-002**: System MUST accept image files in JPEG, PNG, and WebP formats
- **FR-003**: System MUST reject files larger than 5MB with clear error message
- **FR-004**: System MUST validate uploaded files are actual images by attempting to decode/process them - files that cannot be decoded as valid images must be rejected with clear error message
- **FR-005**: System MUST provide crop interface allowing users to position and frame their image before finalizing upload
- **FR-006**: System MUST resize cropped images to 800x800px WebP format (85% quality) before storage
- **FR-007**: System MUST store avatar images in Supabase Storage (existing infrastructure)
- **FR-008**: System MUST generate unique filenames to prevent collisions (e.g., `{user_id}-{timestamp}.{ext}`)
- **FR-009**: System MUST update user profile record with avatar URL after successful upload
- **FR-010**: System MUST display uploaded avatar immediately after successful upload (no page refresh required)
- **FR-011**: System MUST show upload progress indicator during file transfer
- **FR-012**: System MUST display clear error messages for failed uploads (size exceeded, invalid format, network error, etc.)
- **FR-013**: System MUST provide ability to remove/delete existing avatar
- **FR-014**: System MUST display default avatar (or user initials) when no custom avatar exists
- **FR-015**: System MUST enforce WCAG 2.1 AA accessibility requirements (keyboard navigation, screen reader support, focus management)
- **FR-016**: System MUST handle upload failures gracefully with retry option

### Key Entities

- **User Avatar**: Represents profile image associated with a user account
  - Attributes: URL/path to stored image, upload timestamp, file size, dimensions
  - Relationships: One-to-one with User entity (each user has zero or one avatar)
  - Storage: Supabase Storage bucket with public read access, authenticated write access

- **Avatar Metadata**: Information about the uploaded image
  - Attributes: Original filename, MIME type, file size in bytes, original dimensions, processed dimensions
  - Purpose: Debugging, audit trail, storage management

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can upload an avatar and see it displayed within 5 seconds of file selection (including processing time)
- **SC-002**: System successfully processes and stores 100% of valid image uploads (JPEG/PNG/WebP under 5MB)
- **SC-003**: System correctly rejects 100% of invalid uploads with clear error messages
- **SC-004**: Avatar upload interface achieves WCAG 2.1 AA accessibility compliance (verified via automated testing)
- **SC-005**: Uploaded avatars display consistently across all pages where user profile appears
- **SC-006**: 90% of users successfully upload an avatar on their first attempt without needing support
- **SC-007**: System handles 50 concurrent avatar uploads without performance degradation

## Assumptions & Constraints _(documented decisions)_

### Assumptions

- **Assumption 1**: Users are authenticated before accessing Account Settings (handled by existing auth system)
- **Assumption 2**: Supabase Storage bucket exists and is configured for public read, authenticated write
- **Assumption 3**: Users have modern browsers supporting HTML5 File API
- **Assumption 4**: Minimum input dimensions: 200x200 pixels (enforced). Target output dimensions: 800x800 pixels (all uploaded avatars processed to this size)
- **Assumption 5**: Image processing (resize/crop) happens client-side before upload to reduce server load
- **Assumption 6**: Animated images (animated WebP) are allowed but converted to static frame (first frame extracted during Canvas API processing)
- **Assumption 7**: System provides crop interface allowing users to position and frame their image before upload, ensuring users control how their avatar appears

### Constraints

- **Constraint 1**: Must use existing Supabase infrastructure (no additional cloud storage services)
- **Constraint 2**: Must follow ScriptHammer's 5-file component pattern (AvatarUpload component)
- **Constraint 3**: Must maintain mobile-first design with 44px minimum touch targets
- **Constraint 4**: Storage costs must remain under $5/month for 1000 active users
- **Constraint 5**: Implementation must include comprehensive unit tests, Storybook stories, and accessibility tests

## Out of Scope _(explicitly excluded)_

- Webcam photo capture (future enhancement)
- Advanced avatar editing tools (rotate/filter/effects) - basic crop interface only
- Multiple avatars per user or avatar history
- Avatar approval/moderation workflow
- AI-generated avatars or avatar marketplace
- Social avatar imports (Facebook, Twitter, Gravatar integration)

## Clarifications _(resolved ambiguities)_

### Session 2025-10-08

**Q1: When a user uploads a new avatar to replace an existing one, what should happen to the old avatar file?**
→ A: Immediately delete old avatar (save storage costs, no history)

**Q2: How should the system validate that uploaded files are genuine images?**
→ C: Attempt image processing/decoding - most thorough validation, catches all invalid images including corrupted files

**Q3: How should the system handle images with non-square aspect ratios?**
→ B: Allow users to crop/position before upload - best control, ensures desired framing

---

**Status**: All clarifications resolved. Ready for `/plan` to generate implementation plan.
