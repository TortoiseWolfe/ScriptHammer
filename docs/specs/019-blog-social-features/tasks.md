# Task List: Blog Social Media Features

**Feature Branch**: `019-blog-social-features`
**Total Tasks**: 56
**Estimated Complexity**: Medium
**TDD Approach**: Tests before implementation

## Task Execution Strategy

### Parallel Execution Groups

Tasks marked [P] can run in parallel. Group them for efficiency:

```bash
# Example: Run all component generations in parallel
Task T003, T004, T005, T006, T007, T008, T009, T010
```

### Dependencies

- Config files must be created before component implementation
- Components must be generated before tests
- Tests must be written before implementation
- Integration happens after components work

---

## Setup Phase (T001-T002)

### ✅ T001: Create Author Configuration File

**File**: `/home/turtle_wolfe/repos/000/src/config/authors.ts`
**Depends on**: None

```typescript
// Create TypeScript config with Author interfaces
// Include validation functions
// Add default author entries
```

### ✅ T002: Create Social Platform Configuration [P]

**File**: `/home/turtle_wolfe/repos/000/src/config/social.ts`
**Depends on**: None

```typescript
// Define SocialPlatform interfaces
// Configure share URL templates
// Set platform icons and colors
```

---

## Component Generation Phase (T003-T010)

_All can run in parallel [P]_

### ✅ T003: Generate SocialShareButton Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component SocialShareButton blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareButton/`

### ✅ T004: Generate SocialShareGroup Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component SocialShareGroup blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareGroup/`

### ✅ T005: Generate AuthorAvatar Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component AuthorAvatar blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/AuthorAvatar/`

### ✅ T006: Generate AuthorBio Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component AuthorBio blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/AuthorBio/`

### ✅ T007: Generate SocialLink Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component SocialLink blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/SocialLink/`

### ✅ T008: Generate AuthorSocialLinks Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component AuthorSocialLinks blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/AuthorSocialLinks/`

### ✅ T009: Generate AuthorProfile Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component AuthorProfile blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/AuthorProfile/`

### ✅ T010: Generate ShareMetadata Component [P]

**Command**: `docker compose exec scripthammer pnpm run generate:component ShareMetadata blog`
**Creates**: 5 files in `/home/turtle_wolfe/repos/000/src/components/blog/ShareMetadata/`

---

## Test Creation Phase (T011-T034)

_TDD: Write tests before implementation_

### T011: Write SocialShareButton Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareButton/SocialShareButton.test.tsx`
**Depends on**: T003

- Test URL generation for each platform
- Test click handling
- Test analytics tracking with consent
- Test accessibility attributes

### T012: Write SocialShareButton Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/social-share-button.test.tsx`
**Depends on**: T003

- Test with different ShareableContent data
- Test platform-specific behaviors
- Test error states

### T013: Write SocialShareButton Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareButton/SocialShareButton.accessibility.test.tsx`
**Depends on**: T003

- ARIA labels present
- Keyboard navigation
- Focus indicators

### T014: Write SocialShareGroup Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareGroup/SocialShareGroup.test.tsx`
**Depends on**: T004

- Test layout variations
- Test platform filtering
- Test copy link functionality

### T015: Write SocialShareGroup Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/social-share-group.test.tsx`
**Depends on**: T004

- Test with multiple platforms
- Test responsive behavior
- Test event propagation

### T016: Write SocialShareGroup Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareGroup/SocialShareGroup.accessibility.test.tsx`
**Depends on**: T004

### T017: Write AuthorAvatar Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorAvatar/AuthorAvatar.test.tsx`
**Depends on**: T005

- Test image loading
- Test fallback to initials
- Test default avatar

### T018: Write AuthorAvatar Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/author-avatar.test.tsx`
**Depends on**: T005

### T019: Write AuthorAvatar Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorAvatar/AuthorAvatar.accessibility.test.tsx`
**Depends on**: T005

### T020: Write AuthorBio Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorBio/AuthorBio.test.tsx`
**Depends on**: T006

- Test text truncation
- Test markdown rendering
- Test visibility toggle

### T021: Write AuthorBio Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/author-bio.test.tsx`
**Depends on**: T006

### T022: Write AuthorBio Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorBio/AuthorBio.accessibility.test.tsx`
**Depends on**: T006

### T023: Write SocialLink Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialLink/SocialLink.test.tsx`
**Depends on**: T007

- Test URL validation
- Test icon rendering
- Test new tab behavior

### T024: Write SocialLink Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/social-link.test.tsx`
**Depends on**: T007

### T025: Write SocialLink Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialLink/SocialLink.accessibility.test.tsx`
**Depends on**: T007

### T026: Write AuthorSocialLinks Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorSocialLinks/AuthorSocialLinks.test.tsx`
**Depends on**: T008

- Test link filtering
- Test layout modes
- Test empty state

### T027: Write AuthorSocialLinks Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/author-social-links.test.tsx`
**Depends on**: T008

### T028: Write AuthorSocialLinks Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorSocialLinks/AuthorSocialLinks.accessibility.test.tsx`
**Depends on**: T008

### T029: Write AuthorProfile Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorProfile/AuthorProfile.test.tsx`
**Depends on**: T009

- Test variant rendering
- Test data loading
- Test preference handling

### T030: Write AuthorProfile Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/author-profile.test.tsx`
**Depends on**: T009

### T031: Write AuthorProfile Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorProfile/AuthorProfile.accessibility.test.tsx`
**Depends on**: T009

### T032: Write ShareMetadata Unit Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/ShareMetadata/ShareMetadata.test.tsx`
**Depends on**: T010

- Test meta tag generation
- Test Open Graph tags
- Test Twitter Cards

### T033: Write ShareMetadata Integration Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/tests/integration/share-metadata.test.tsx`
**Depends on**: T010

### T034: Write ShareMetadata Accessibility Tests [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/ShareMetadata/ShareMetadata.accessibility.test.tsx`
**Depends on**: T010

---

## Storybook Phase (T035-T042)

_All can run in parallel [P]_

### T035: Create SocialShareButton Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareButton/SocialShareButton.stories.tsx`
**Depends on**: T011

- Default state
- All platform variants
- Disabled state
- Loading state

### T036: Create SocialShareGroup Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareGroup/SocialShareGroup.stories.tsx`
**Depends on**: T014

- Horizontal layout
- Vertical layout
- Grid layout
- Mobile responsive

### T037: Create AuthorAvatar Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorAvatar/AuthorAvatar.stories.tsx`
**Depends on**: T017

- With image
- With initials
- Default avatar
- Different sizes

### T038: Create AuthorBio Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorBio/AuthorBio.stories.tsx`
**Depends on**: T020

- Short bio
- Long bio
- Truncated
- Markdown content

### T039: Create SocialLink Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialLink/SocialLink.stories.tsx`
**Depends on**: T023

- All platform types
- With/without icons
- Hover states

### T040: Create AuthorSocialLinks Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorSocialLinks/AuthorSocialLinks.stories.tsx`
**Depends on**: T026

- Full set of links
- Partial links
- Empty state
- Responsive layouts

### T041: Create AuthorProfile Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorProfile/AuthorProfile.stories.tsx`
**Depends on**: T029

- Compact variant
- Full variant
- Minimal variant
- With/without social

### T042: Create ShareMetadata Stories [P]

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/ShareMetadata/ShareMetadata.stories.tsx`
**Depends on**: T032

- Blog post metadata
- Page metadata
- Missing image fallback

---

## Implementation Phase (T043-T050)

### T043: Implement SocialShareButton Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareButton/SocialShareButton.tsx`
**Depends on**: T011, T001, T002

- Generate share URLs
- Handle click events
- Track analytics (with consent)
- Apply theme styles

### T044: Implement SocialShareGroup Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialShareGroup/SocialShareGroup.tsx`
**Depends on**: T014, T043

- Render button group
- Handle layout modes
- Implement copy link
- Manage state

### T045: Implement AuthorAvatar Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorAvatar/AuthorAvatar.tsx`
**Depends on**: T017, T001

- Load avatar image
- Generate initials
- Handle fallbacks
- Apply sizes

### T046: Implement AuthorBio Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorBio/AuthorBio.tsx`
**Depends on**: T020, T001

- Render bio text
- Handle truncation
- Process markdown
- Toggle visibility

### T047: Implement SocialLink Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/SocialLink/SocialLink.tsx`
**Depends on**: T023, T002

- Render link with icon
- Validate URLs
- Handle external links
- Apply styles

### T048: Implement AuthorSocialLinks Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorSocialLinks/AuthorSocialLinks.tsx`
**Depends on**: T026, T047

- Render link collection
- Filter by preference
- Handle layout
- Manage empty state

### T049: Implement AuthorProfile Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/AuthorProfile/AuthorProfile.tsx`
**Depends on**: T029, T045, T046, T048

- Compose sub-components
- Load author data
- Handle variants
- Apply preferences

### T050: Implement ShareMetadata Component

**File**: `/home/turtle_wolfe/repos/000/src/components/blog/ShareMetadata/ShareMetadata.tsx`
**Depends on**: T032

- Generate meta tags
- Handle Next.js metadata API
- Process Open Graph
- Generate Twitter Cards

---

## Integration Phase (T051-T053)

### T051: Integrate Social Sharing into Blog Post Page

**File**: `/home/turtle_wolfe/repos/000/src/app/blog/[slug]/page.tsx`
**Depends on**: T044, T049, T050

- Add SocialShareGroup after content
- Add AuthorProfile section
- Update metadata generation
- Test with real posts

### T052: Integrate Author Info into Blog List

**File**: `/home/turtle_wolfe/repos/000/src/app/blog/page.tsx`
**Depends on**: T049

- Add author to PostCard
- Show mini profile
- Link to full posts

### T053: Create Blog Layout Updates

**File**: `/home/turtle_wolfe/repos/000/src/app/blog/layout.tsx`
**Depends on**: T050

- Add global metadata
- Configure share defaults
- Set up analytics context

---

## Verification Phase (T054-T056)

### T054: Run Full Accessibility Audit [P]

**Command**: `docker compose exec scripthammer pnpm test:a11y`
**Depends on**: T051, T052, T053

- Verify WCAG AA compliance
- Check keyboard navigation
- Test screen reader support
- Document any issues

### T055: Verify Performance Metrics [P]

**Command**: `docker compose exec scripthammer pnpm run build && pnpm run analyze`
**Depends on**: T051, T052, T053

- Check bundle size impact
- Run Lighthouse audit
- Verify Core Web Vitals
- Ensure < 150KB first load

### T056: Execute E2E Test Suite [P]

**Command**: `docker compose exec scripthammer pnpm test:e2e`
**Depends on**: T051, T052, T053

- Test share flow end-to-end
- Test author profile navigation
- Test responsive behavior
- Verify analytics tracking

---

## Parallel Execution Examples

### Phase 1: Setup & Generation (Parallel)

```bash
# Run in separate terminals or with Task agents
Task T001 "Create Author Configuration"
Task T002 "Create Social Platform Configuration"
Task T003-T010 "Generate all 8 components"
```

### Phase 2: Test Creation (Parallel after components)

```bash
# After components are generated
Task T011-T013 "SocialShareButton tests"
Task T014-T016 "SocialShareGroup tests"
Task T017-T019 "AuthorAvatar tests"
Task T020-T022 "AuthorBio tests"
Task T023-T025 "SocialLink tests"
Task T026-T028 "AuthorSocialLinks tests"
Task T029-T031 "AuthorProfile tests"
Task T032-T034 "ShareMetadata tests"
```

### Phase 3: Stories (Parallel)

```bash
# After tests are written
Task T035-T042 "All Storybook stories"
```

### Phase 4: Implementation (Sequential within component, parallel across)

```bash
# Implement base components first
Task T043 "SocialShareButton"
Task T045 "AuthorAvatar"
Task T046 "AuthorBio"
Task T047 "SocialLink"

# Then composite components
Task T044 "SocialShareGroup" (needs T043)
Task T048 "AuthorSocialLinks" (needs T047)
Task T049 "AuthorProfile" (needs T045, T046, T048)
Task T050 "ShareMetadata"
```

### Phase 5: Integration (Sequential)

```bash
Task T051 "Blog Post integration"
Task T052 "Blog List integration"
Task T053 "Layout updates"
```

### Phase 6: Verification (Parallel)

```bash
Task T054 "Accessibility audit"
Task T055 "Performance check"
Task T056 "E2E tests"
```

---

## Success Criteria

- [ ] All 56 tasks completed
- [ ] All tests passing (unit, integration, a11y)
- [ ] Storybook stories rendering correctly
- [ ] Lighthouse scores maintained (90+ performance)
- [ ] WCAG AA compliance verified
- [ ] Bundle size under 150KB first load
- [ ] E2E tests passing
- [ ] Social sharing working on all platforms
- [ ] Author profiles displaying correctly
- [ ] Analytics tracking with consent
