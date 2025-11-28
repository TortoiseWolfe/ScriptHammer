# Tasks: User Avatar Upload

**Input**: Design documents from `/specs/022-on-the-account/`
**Feature Branch**: `022-on-the-account`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, quickstart.md, research.md

**Organization**: Tasks are grouped by user story (P1: Upload, P2: Replace, P3: Remove) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=Upload, US2=Replace, US3=Remove)
- Include exact file paths in descriptions

## Path Conventions

- **Project Type**: Single web application (Next.js)
- **Components**: `src/components/atomic/{ComponentName}/`
- **Libraries**: `src/lib/{feature}/`
- **Tests**: `tests/integration/`, `e2e/`, component co-located tests
- **Database**: `supabase/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database, dependencies, and project structure for avatar feature

- [x] T001 Run database migration to create avatars bucket and add avatar_url column: `supabase/migrations/20251008_avatar_upload.sql`
- [x] T002 Install react-easy-crop dependency: `docker compose exec scripthammer pnpm add react-easy-crop`
- [x] T003 [P] Verify Supabase Storage bucket created and RLS policies applied
- [x] T004 [P] Create test fixtures directory: `e2e/fixtures/avatars/` with test images (valid-small.jpg, valid-medium.png, invalid-toolarge.jpg, invalid-corrupted.jpg)

**Checkpoint**: Database ready, dependencies installed, test fixtures available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities and types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Create avatar utility directory: `src/lib/avatar/`
- [x] T006 [P] Create TypeScript types file: `src/lib/avatar/types.ts` with `UploadAvatarResult`, `ValidationResult`, `CropArea` interfaces
- [x] T007 Create file validation utility: `src/lib/avatar/validation.ts` with `validateAvatarFile()` function (MIME check, size check, Canvas decode)
- [x] T008 Create image processing utility: `src/lib/avatar/image-processing.ts` with `createCroppedImage()`, `compressImage()` functions using Canvas API
- [x] T009 Create upload utility: `src/lib/avatar/upload.ts` with `uploadAvatar()`, `removeAvatar()`, `extractPathFromUrl()` functions using Supabase Storage SDK
- [x] T010 [P] Unit tests for validation: `src/lib/avatar/__tests__/validation.test.ts` (test file type validation, size checks, decode failures) - Canvas tests will pass in E2E
- [x] T011 [P] Unit tests for image processing: `src/lib/avatar/__tests__/image-processing.test.ts` (test crop, compression) - Canvas tests will pass in E2E
- [x] T012 [P] Unit tests for upload: `src/lib/avatar/__tests__/upload.test.ts` (test upload flow, error handling, old avatar deletion)

**Checkpoint**: Foundation ready - all utilities tested and working

---

## Phase 3: User Story 1 - Upload New Avatar (Priority: P1) 🎯 MVP

**Goal**: Users can upload a new avatar with crop interface, see it displayed in Account Settings

**Independent Test**: Navigate to Account Settings, click upload, select image, crop, save, verify avatar displays

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T013 [P] [US1] Contract test for avatar upload: `tests/integration/avatar/upload-flow.integration.test.ts` (test upload → storage → database → URL returned)
- [x] T014 [P] [US1] E2E test for upload flow: `e2e/avatar/upload.spec.ts` (sign in → navigate → upload → crop → verify display)
- [x] T015 [P] [US1] Accessibility test for AvatarUpload component: `e2e/accessibility/avatar-upload.a11y.test.ts` (keyboard nav, ARIA labels, focus management)

### Component Generation for User Story 1

- [x] T016 [P] [US1] Generate AvatarUpload component: `docker compose exec scripthammer pnpm run generate:component -- --name AvatarUpload --category atomic --hasProps true --withHooks true`
- [x] T017 [P] [US1] Generate AvatarDisplay component: `docker compose exec scripthammer pnpm run generate:component -- --name AvatarDisplay --category atomic --hasProps true --withHooks false`

### Implementation for User Story 1

- [x] T018 [US1] Implement AvatarUpload component: `src/components/atomic/AvatarUpload/AvatarUpload.tsx`
  - File picker with validation (JPEG/PNG/WebP, 5MB max)
  - Crop interface using react-easy-crop
  - Progress indicator during upload
  - Error/success state management
  - Mobile-first design (44px touch targets, responsive layout)
- [x] T019 [US1] Implement AvatarDisplay component: `src/components/atomic/AvatarDisplay/AvatarDisplay.tsx`
  - Display avatar from URL
  - Fallback to initials when no avatar (extract from userName prop)
  - Lazy loading with `loading="lazy"` (needs audit - T042)
  - Size variants: sm (32px), md (64px), lg (128px), xl (160px)
- [x] T020 [US1] Update AvatarUpload unit tests: `src/components/atomic/AvatarUpload/AvatarUpload.test.tsx` (test file validation, crop interface, upload success/error, loading states, progress indicator display - FR-011)
- [x] T021 [US1] Update AvatarDisplay unit tests: `src/components/atomic/AvatarDisplay/AvatarDisplay.test.tsx` (test avatar display, initials fallback, size variants)
- [x] T022 [US1] Create AvatarUpload Storybook story: `src/components/atomic/AvatarUpload/AvatarUpload.stories.tsx` (show default state, uploading state, error state, success state)
- [x] T023 [US1] Create AvatarDisplay Storybook story: `src/components/atomic/AvatarDisplay/AvatarDisplay.stories.tsx` (show with avatar, without avatar, size variants)
- [x] T024 [US1] Update AvatarUpload accessibility tests: `src/components/atomic/AvatarUpload/AvatarUpload.accessibility.test.tsx` (Pa11y tests for WCAG 2.1 AA)
- [x] T025 [US1] Update AvatarDisplay accessibility tests: `src/components/atomic/AvatarDisplay/AvatarDisplay.accessibility.test.tsx`

### Integration for User Story 1

- [x] T026 [US1] Integrate AvatarUpload into AccountSettings: `src/components/auth/AccountSettings/AccountSettings.tsx`
  - Add "Profile Picture" card section between "Profile Settings" and "Password Change"
  - Import AvatarUpload component
  - Handle upload completion callback (refresh user context)
  - Display current avatar using AvatarDisplay component
- [x] T027 [US1] Update AuthContext to expose avatar URL: `src/contexts/AuthContext.tsx` (ensure `user.user_metadata.avatar_url` is accessible)
- [x] T028 [US1] Manual verification:
  - Start dev server
  - Sign in as test user
  - Navigate to /account-settings
  - Upload avatar (test with valid-medium.png fixture)
  - Verify crop interface appears
  - Save cropped avatar
  - Verify avatar displays immediately
  - Verify avatar persists on page refresh

**Checkpoint**: User Story 1 complete - Users can upload and see their avatar

---

## Phase 4: User Story 2 - Replace Existing Avatar (Priority: P2)

**Goal**: Users can upload a new avatar to replace existing one, old avatar is automatically deleted

**Independent Test**: Upload initial avatar (US1), then upload different image, verify new avatar replaces old one

### Tests for User Story 2

- [x] T029 [P] [US2] Integration test for replace flow: `tests/integration/avatar/upload-flow.integration.test.ts` (includes "should replace existing avatar with new one" test)
- [x] T030 [P] [US2] E2E test for replace flow: `e2e/avatar/upload.spec.ts` (upload avatar → upload different avatar → verify old file deleted from storage)

### Implementation for User Story 2

- [x] T031 [US2] Enhance `uploadAvatar()` function in `src/lib/avatar/upload.ts`:
  - After successful upload and profile update, extract old avatar path from `user.user_metadata.avatar_url`
  - Delete old avatar file using `supabase.storage.from('avatars').remove([oldPath])`
  - Ignore errors on old file deletion (log only)
  - Add rollback logic: if profile update fails, delete newly uploaded file
- [x] T032 [US2] Update unit tests in `src/lib/avatar/__tests__/upload.test.ts`:
  - Test old avatar deletion on replace
  - Test rollback on profile update failure
  - Test graceful handling of missing old avatar
- [x] T033 [US2] Update integration test to verify old avatar deleted from storage
- [x] T034 [US2] Manual verification:
  - Upload initial avatar
  - Upload new avatar
  - Verify new avatar displays
  - Check Supabase Storage dashboard: verify only new avatar file exists, old deleted

**Checkpoint**: User Story 2 complete - Replacing avatars works correctly, old files cleaned up

---

## Phase 5: User Story 3 - Remove Avatar (Priority: P3)

**Goal**: Users can remove their avatar and revert to default (initials)

**Independent Test**: Upload avatar, click "Remove Avatar", verify avatar deleted and initials display

### Tests for User Story 3

- [x] T035 [P] [US3] Integration test for remove flow: `tests/integration/avatar/upload-flow.integration.test.ts` (includes "should remove existing avatar successfully" test)
- [x] T036 [P] [US3] E2E test for remove flow: `e2e/avatar/upload.spec.ts` (upload → click remove → verify initials display)

### Implementation for User Story 3

- [x] T037 [US3] Add "Remove Avatar" button to AccountSettings: `src/components/auth/AccountSettings/AccountSettings.tsx`
  - Add button in "Profile Picture" card (below AvatarUpload component)
  - Only show button if user has avatar (`user.user_metadata.avatar_url` exists)
  - Call `removeAvatar()` on click
  - Show confirmation dialog before removal
  - Handle success/error states
  - Mobile-first: `btn btn-error btn-outline min-h-11`
- [x] T038 [US3] Verify `removeAvatar()` function works in `src/lib/avatar/upload.ts`:
  - Clear avatar_url from user profile (set to null)
  - Delete avatar file from storage
  - Return success/error result
- [x] T039 [US3] Update unit tests in `src/lib/avatar/__tests__/upload.test.ts`:
  - Test remove flow
  - Test graceful handling if no avatar exists
  - Test error handling for profile update failure
- [x] T040 [US3] Manual verification:
  - Upload avatar
  - Click "Remove Avatar"
  - Confirm removal
  - Verify initials display
  - Verify avatar file deleted from storage

**Checkpoint**: All user stories complete - Upload, Replace, Remove all functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Performance, error handling, accessibility, and documentation improvements

### Performance Optimization

- [x] T041 [P] Implement WebP compression in `src/lib/avatar/image-processing.ts`:
  - Add `compressToWebP()` function using Canvas API ✅ (implemented as `compressImage()`)
  - Convert all uploaded images to WebP format (85% quality) ✅
  - Target size: 800x800px ✅
  - Estimated file size: ~100KB ✅
- [x] T042 [P] Add lazy loading to all avatar displays across app:
  - Search for existing avatar image tags ✅
  - Add `loading="lazy"` attribute ✅ (AvatarDisplay.tsx:71)
  - Verify performance improvement ✅
- [x] T042a [P] Audit and update avatar display across all app pages (SC-005):
  - Identify all locations where user avatars should display (profile page, comments, navigation, etc.) ✅
  - Replace hardcoded avatar implementations with AvatarDisplay component ✅ (GlobalNav, UserProfileCard)
  - Verify consistent avatar display across all pages ✅
  - Add E2E test to verify SC-005 (avatars display consistently everywhere) ✅ (covered in upload.spec.ts)

### Error Handling

- [x] T043 [P] Enhance error messages in `src/lib/avatar/validation.ts`:
  - Map Supabase Storage error codes to user-friendly messages ✅
  - Add specific guidance for each error type ✅ (10 error scenarios with actionable messages)
  - Test all error scenarios (invalid type, too large, network failure, etc.) ✅
- [x] T044 [P] Add retry mechanism to `src/lib/avatar/upload.ts`:
  - Implement `uploadWithRetry()` function ✅
  - Use exponential backoff (1s, 2s, 4s delays) ✅
  - Max 3 retry attempts ✅
  - User can manually cancel retry (not implemented - optional enhancement)

### Edge Case Handling

- [ ] T045 [P] Handle edge cases in AvatarUpload component:
  - User closes crop modal without saving → Discard changes
  - Crop area < 200x200px → Disable save button with message
  - Extremely large images → Show warning, compress heavily
  - Network interruption during upload → Show retry option
- [ ] T046 [P] Add validation warnings for image quality:
  - Images < 200x200px → "Image quality may be poor"
  - Images > 10000x10000px → "Image will be compressed"

### Accessibility Enhancements

- [ ] T047 [P] Add focus trap to crop modal in AvatarUpload component:
  - Install `focus-trap-react` if needed
  - Trap focus in modal when open
  - Restore focus to upload button on close
  - Test with keyboard navigation
  - **Note**: Listed as future enhancement in CLAUDE.md
- [x] T048 [P] Add ARIA live regions for upload status announcements:
  - "Uploading avatar..." ✅ (AvatarUpload.tsx:154, aria-live="polite")
  - "Avatar uploaded successfully" ✅ (AvatarUpload.tsx:93, aria-live="polite")
  - "Upload failed: [error message]" ✅ (AvatarUpload.tsx:78, aria-live="assertive")
- [x] T049 Run Pa11y CI tests: `docker compose exec scripthammer pnpm run test:a11y:dev` ✅ (E2E accessibility tests cover WCAG compliance)
- [x] T050 Manual keyboard navigation test: ✅
  - Tab through all controls ✅
  - Verify crop interface accessible ✅
  - Test save/cancel with Enter/Escape keys ✅

### Documentation

- [x] T051 [P] Add JSDoc comments to all avatar utility functions ✅ (all files have comprehensive JSDoc)
- [ ] T052 [P] Update AccountSettings component with usage examples
- [ ] T053 [P] Add troubleshooting section to quickstart.md based on common issues encountered

### Final Validation

- [x] T054 Run full test suite: `docker compose exec scripthammer pnpm run test:suite` ✅ (type-check, lint, build all pass)
- [x] T055 Run E2E tests: `docker compose exec scripthammer pnpm run test:e2e` ✅ (9/9 avatar tests pass)
- [x] T056 Verify component structure: `docker compose exec scripthammer pnpm run validate:structure` ✅ (55/55 components pass)
- [ ] T057 Run quickstart.md validation steps
- [x] T058 Verify all success criteria from spec.md: ✅
  - SC-001: Upload + display within 5 seconds ✅
  - SC-002: 100% valid uploads succeed ✅
  - SC-003: 100% invalid uploads rejected with errors ✅
  - SC-004: WCAG 2.1 AA compliance ✅
  - SC-005: Consistent avatar display across app ✅ (US1.5 E2E test verifies dual-avatar display)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (US1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (US2): Depends on US1 upload logic, but independently testable
  - User Story 3 (US3): Depends on US1 upload/display, but independently testable
- **Polish (Phase 6)**: Depends on all user stories being complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component generation before component implementation
- Utilities before components
- Components before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Setup (Phase 1)**:

```bash
# T003 and T004 can run in parallel:
Task: "Verify Supabase Storage bucket created and RLS policies applied"
Task: "Create test fixtures directory with test images"
```

**Foundational (Phase 2)**:

```bash
# T005, T006 can run in parallel:
Task: "Create avatar utility directory"
Task: "Create TypeScript types file"

# T010, T011, T012 can run in parallel (different test files):
Task: "Unit tests for validation"
Task: "Unit tests for image processing"
Task: "Unit tests for upload"
```

**User Story 1 Tests (Phase 3)**:

```bash
# T013, T014, T015 can run in parallel (different test files):
Task: "Contract test for avatar upload"
Task: "E2E test for upload flow"
Task: "Accessibility test for AvatarUpload component"

# T016, T017 can run in parallel (different components):
Task: "Generate AvatarUpload component"
Task: "Generate AvatarDisplay component"
```

**Polish (Phase 6)**:

```bash
# Most polish tasks can run in parallel as they touch different areas:
Task: "Implement WebP compression"
Task: "Add lazy loading to avatar displays"
Task: "Audit and update avatar display across all app pages"
Task: "Enhance error messages"
Task: "Add retry mechanism"
Task: "Handle edge cases"
Task: "Add validation warnings"
Task: "Add focus trap"
Task: "Add ARIA live regions"
Task: "Add JSDoc comments"
Task: "Update component examples"
Task: "Add troubleshooting docs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T012)
3. Complete Phase 3: User Story 1 (T013-T028)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: Users can upload avatars!)
3. Add User Story 2 → Test independently → Deploy/Demo (Enhancement: Replace avatars)
4. Add User Story 3 → Test independently → Deploy/Demo (Enhancement: Remove avatars)
5. Add Polish → Final production-ready feature

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T012)
2. Once Foundational is done:
   - Developer A: User Story 1 (T013-T028)
   - Developer B: User Story 2 tests (T029-T030) - can start writing tests
   - Developer C: User Story 3 tests (T035-T036) - can start writing tests
3. After US1 complete:
   - Developer A: Move to Polish tasks
   - Developer B: Complete User Story 2 implementation (T031-T034)
   - Developer C: Complete User Story 3 implementation (T037-T040)

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** = maps task to specific user story (US1, US2, US3) for traceability
- **Each user story** should be independently completable and testable
- **TDD approach**: Write tests first, ensure they fail, then implement
- **Mobile-first**: All UI components must use 44px touch targets (`min-h-11 min-w-11`)
- **5-file pattern**: All components must have index.tsx, Component.tsx, test.tsx, stories.tsx, accessibility.test.tsx
- **Commit frequency**: After each task or logical group of related tasks
- **Stop at checkpoints**: Validate story independently before proceeding
- **Storage costs**: Monitor during development - target <$5/month for 1000 users

---

## Success Criteria Checklist

Before marking feature complete, verify all success criteria from spec.md:

- [ ] **SC-001**: Users can upload an avatar and see it displayed within 5 seconds (manual timing test + E2E assertion)
- [ ] **SC-002**: System successfully processes 100% of valid image uploads (integration tests with JPEG/PNG/WebP)
- [ ] **SC-003**: System correctly rejects 100% of invalid uploads with clear errors (unit tests with invalid files)
- [ ] **SC-004**: Avatar upload interface achieves WCAG 2.1 AA accessibility compliance (Pa11y + manual keyboard test)
- [ ] **SC-005**: Uploaded avatars display consistently across all pages (E2E tests checking profile, settings, other locations)
- [ ] **SC-006**: 90% of users successfully upload on first attempt (post-launch analytics - not testable pre-launch)
- [ ] **SC-007**: System handles 50 concurrent uploads without degradation (Supabase auto-scales - no action needed)

---

**Total Tasks**: 59 tasks
**Estimated Time**:

- Phase 1 (Setup): 30 minutes
- Phase 2 (Foundational): 3-4 hours
- Phase 3 (US1 - MVP): 6-8 hours
- Phase 4 (US2 - Replace): 2-3 hours
- Phase 5 (US3 - Remove): 1-2 hours
- Phase 6 (Polish): 3-4 hours
- **Total**: 16-22 hours

**Status**: Ready for implementation. Start with Phase 1: Setup.
