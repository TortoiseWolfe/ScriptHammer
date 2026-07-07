# Implementation Plan: Mobile-First Design Overhaul

**Branch**: `017-mobile-first-design` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-mobile-first-design/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path ✓
   → Spec loaded successfully with 27 FR + 13 NFR
2. Fill Technical Context ✓
   → Detected Project Type: web (Next.js frontend)
   → Set Structure Decision: Option 1 (Single project with src/)
3. Fill Constitution Check section ✓
4. Evaluate Constitution Check section
   → In Progress: Checking all constitutional requirements
5. Execute Phase 0 → research.md
   → Starting research phase
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Pending
7. Re-evaluate Constitution Check section
   → Pending
8. Plan Phase 2 → Describe task generation approach
   → Pending
9. STOP - Ready for /tasks command
   → Pending
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

**Primary Requirement**: Implement comprehensive mobile-first responsive design across entire ScriptHammer site to fix current desktop-cramped-on-mobile experience.

**Technical Approach**:

- Mobile-first CSS development starting from 320px viewport
- Progressive enhancement for tablet (768px+) and desktop (1024px+)
- Tailwind responsive utilities with custom mobile-first breakpoints
- Component-level responsive patterns following atomic design
- Touch-first interactions with 44x44px minimum tap targets
- Automated testing for horizontal scroll detection and touch target validation
- Visual regression baselines for mobile layouts

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+ LTS
**Primary Dependencies**: Next.js 15.5, React 19, Tailwind CSS 4, DaisyUI
**Storage**: N/A (layout/styling changes only)
**Testing**: Vitest, Playwright (mobile viewports), Pa11y, React Testing Library
**Target Platform**: Static export, PWA-capable, all modern browsers
**Project Type**: web (Next.js App Router with static export)
**Performance Goals**: Lighthouse 90+, FCP <2s, TTI <3.5s, CLS <0.1 (mobile)
**Constraints**: Bundle <150KB first load, WCAG AA compliant, zero horizontal scroll on mobile
**Scale/Scope**: Site-wide mobile-first redesign across all components and layouts

**Mobile-Specific Context**:

- Target widths: 320px (iPhone SE), 375px (iPhone 13 Mini), 390px (iPhone 12/13/14), 428px (iPhone 14 Pro Max)
- Breakpoints: mobile (320-767px), tablet (768-1023px), desktop (1024px+)
- Orientation detection required for landscape mobile devices
- Font size capping at "large" for screens <375px
- Modern image formats (WebP/AVIF) with responsive srcset

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Component Structure Compliance

- [x] All components follow 5-file pattern (index, Component, test, stories, a11y)
  - No new components required, modifying existing components
  - Existing components already follow 5-file pattern
- [x] Using `pnpm run generate:component` for new components
  - N/A - no new components needed
- [x] No manual component creation
  - N/A - only modifying existing components

### II. Test-First Development

- [x] Tests written before implementation (RED-GREEN-REFACTOR)
  - Will write Playwright tests for mobile violations before fixes
  - Will add unit tests for responsive utility functions
- [x] Minimum 25% unit test coverage
  - Current: 58%, will maintain or improve
- [x] E2E tests for user workflows
  - Will add mobile-specific E2E tests (horizontal scroll, touch targets)
- [x] Accessibility tests with Pa11y
  - Existing Pa11y tests will validate mobile accessibility

### III. PRP Methodology

- [x] Following PRP workflow (spec → plan → tasks → implement)
  - Currently executing /plan after /specify and /clarify
- [x] Clear success criteria defined
  - 6 success criteria defined in spec (SC1-SC6)
- [x] Tracking from inception to completion
  - PRP-017 tracked in PRP-STATUS.md

### IV. Docker-First Development

- [x] Docker Compose setup included
  - Existing Docker environment used for all development
- [x] CI/CD uses containerized environments
  - GitHub Actions already containerized
- [x] Environment consistency maintained
  - No environment changes needed

### V. Progressive Enhancement

- [x] Core functionality works without JS
  - Layout and styling work without JS
- [x] PWA capabilities for offline support
  - Existing PWA functionality maintained
- [x] Accessibility features included
  - Touch targets, keyboard navigation, WCAG AA compliance
- [x] Mobile-first responsive design
  - **This is the entire focus of PRP-017**

### VI. Privacy & Compliance First

- [x] GDPR compliance with consent system
  - No new data collection, existing consent system maintained
- [x] Analytics only after consent
  - No changes to analytics
- [x] Third-party services need modals
  - No new third-party services
- [x] Privacy controls accessible
  - Maintaining existing privacy controls

**Constitution Check: PASS** ✅

## Project Structure

### Documentation (this feature)

```
specs/017-mobile-first-design/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) - IN PROGRESS
├── data-model.md        # Phase 1 output (/plan command) - PENDING
├── quickstart.md        # Phase 1 output (/plan command) - PENDING
├── contracts/           # Phase 1 output (/plan command) - PENDING
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── app/                 # Pages requiring mobile-first layouts
│   ├── layout.tsx       # Root layout with responsive meta tags
│   ├── page.tsx         # Homepage mobile layout
│   └── blog/            # Blog pages mobile optimization
├── components/          # Components requiring mobile-first updates
│   ├── atomic/          # Basic components (buttons, inputs, controls)
│   ├── molecular/       # Composite components (cards, navigation)
│   ├── organisms/       # Complex components (headers, footers)
│   └── templates/       # Page templates
├── styles/              # Global styles and Tailwind config
│   └── globals.css      # Mobile-first base styles
└── utils/               # Utility functions for responsive logic

tests/
├── e2e/                 # Playwright mobile tests
│   ├── mobile-horizontal-scroll.spec.ts
│   ├── mobile-touch-targets.spec.ts
│   └── mobile-navigation.spec.ts
└── unit/                # Unit tests for utilities
    └── responsive-utils.test.ts

tailwind.config.ts       # Mobile-first breakpoint configuration
playwright.config.ts     # Mobile device configurations
```

**Structure Decision**: Option 1 (Single project) - This is a styling/layout feature affecting existing Next.js application structure.

## Phase 0: Outline & Research ✅ COMPLETE

### Research Tasks Completed

1. **Mobile-First CSS Architecture** ✅
   - Decision: Hybrid approach with Tailwind CSS 4 + DaisyUI 5 + Fluid Typography
   - Custom breakpoints: xs (320px), sm (428px), md (768px), lg (1024px)
   - Fluid typography using CSS clamp() for responsive scaling
   - Mobile-first utility classes for common patterns

2. **Touch Target Standards** ✅
   - Decision: Target 44×44px minimum (WCAG AAA + Apple HIG)
   - WCAG 2.2 Level AA: 24×24px (legal baseline)
   - WCAG 2.2 Level AAA: 44×44px (recommended)
   - 8px minimum spacing between interactive elements

3. **Responsive Image Optimization** ✅
   - Decision: Manual optimization with Sharp + HTML `<picture>` element
   - AVIF + WebP + PNG formats in preference order
   - Multiple sizes: 428w (mobile), 768w (tablet), 1440w (desktop)
   - Expected: 71% bandwidth reduction, 85% faster on 3G/4G

4. **Orientation Detection** ✅
   - Decision: Hybrid CSS media query + JavaScript device detection
   - Combines viewport dimensions with touch capabilities
   - Maintains mobile styles in landscape (iPhone 12 at 844x390 stays mobile)
   - WCAG 1.3.4 compliant (supports both orientations)

5. **Horizontal Scroll Detection** ✅
   - Strategy: Playwright viewport testing at multiple widths
   - Automated detection via scrollWidth vs viewport width
   - Visual regression with screenshot comparison
   - Test matrix: 320px, 390px, 428px, 768px, 1024px

6. **Font Size Management** ✅
   - Decision: Fluid typography with clamp() + scale factor
   - Cap at "large" (1.125rem) on screens <375px
   - Prevents x-large selection from breaking layouts
   - Maintains accessibility with zoom support

**Output**: ✅ `research.md` created with comprehensive findings (4 major research areas, 15+ decisions documented)

---

## Phase 1: Design & Contracts ✅ COMPLETE

### 1. Data Model Extraction

**Entities Identified**:

- `BreakpointConfig`: Responsive breakpoint definitions
- `DeviceInfo`: Runtime device detection
- `TouchTarget`: Touch target specifications and validation
- `ResponsiveImageConfig`: Image optimization configuration
- `TypographyScale`: Fluid typography definitions
- `TestViewport`: Playwright test viewport configurations

**Output**: ✅ `data-model.md` created with 6 core entities, TypeScript interfaces, validation rules, and relationships

### 2. API Contracts

**Note**: This is a frontend-only feature (CSS/layout changes), so traditional API contracts are not applicable. Instead, we have:

**Component Contracts** (TypeScript interfaces):

- `ResponsiveImage` component props interface
- `useDeviceType` hook return type
- Touch target validation function signatures
- Image optimization script configuration

**Configuration Contracts**:

- Tailwind breakpoint configuration
- Playwright test viewport configuration
- DaisyUI button size standards
- Touch target compliance standards

**Output**: ✅ Defined in `data-model.md` with full TypeScript definitions

### 3. Test Scenarios

**Extracted from User Stories** (spec.md):

**Test Scenario 1**: Navigation Fits Mobile Viewport

- Given: User visits homepage on 320px device
- When: Page loads
- Then: Navigation header fits within viewport with no horizontal scroll
- Test: `e2e/mobile-navigation.spec.ts`

**Test Scenario 2**: Text Readable Without Zoom

- Given: User reads blog post on 390px device
- When: Scrolling through content
- Then: Text is ≥16px, comfortable to read without zooming
- Test: `e2e/mobile-typography.spec.ts`

**Test Scenario 3**: Touch Targets Meet Standards

- Given: User taps navigation controls on 375px device
- When: Interacting with buttons
- Then: All touch targets ≥44×44px with 8px spacing
- Test: `e2e/mobile-touch-targets.spec.ts`

**Test Scenario 4**: Zero Horizontal Scroll

- Given: User views any page at mobile widths (320px-428px)
- When: Page loads
- Then: No horizontal scroll across entire page
- Test: `e2e/mobile-horizontal-scroll.spec.ts`

**Test Scenario 5**: Mobile-First Layouts (Not Scaled Desktop)

- Given: Mobile user views site vs desktop
- When: Observing layouts
- Then: Mobile layouts purpose-built (cards stack, navigation adapts)
- Test: `e2e/mobile-layout-patterns.spec.ts`

**Output**: ✅ 5 test scenarios defined in `quickstart.md` with acceptance criteria

### 4. Quickstart Guide

**Created**: ✅ `quickstart.md` (30-minute developer onboarding)

**Contents**:

- Prerequisites and environment setup
- Step-by-step implementation guide
- Validation checklist
- Troubleshooting guide
- Success criteria
- Quick reference commands

**Quickstart Validates**:

1. Identify current mobile issues
2. Establish baseline test metrics
3. Add mobile-first Tailwind configuration
4. Fix critical navigation overflow
5. Verify improvements with tests

**Output**: ✅ `quickstart.md` created with 5-step implementation guide

### 5. Update CLAUDE.md Context

**Incremental Update Required**:

- Add mobile-first design principles section
- Document touch target standards (44×44px)
- Add responsive image optimization workflow
- Document orientation detection patterns
- Add mobile testing requirements

**Location**: `/home/turtle_wolfe/repos/ScriptHammer/CLAUDE.md`

**Changes Needed**:

```markdown
## Mobile-First Design (PRP-017)

### Core Principles

- Start mobile (320px), enhance progressively
- Touch targets: 44×44px minimum (WCAG AAA)
- Zero horizontal scroll on mobile
- Fluid typography with clamp()
- Test at 320px, 390px, 428px

### Breakpoints

- xs: 320px (small phones)
- sm: 428px (standard phones)
- md: 768px (tablets)
- lg: 1024px (desktop)

### Touch Target Standards

- Minimum: 44×44px (Apple HIG / WCAG AAA)
- Spacing: 8px between elements
- Never use btn-xs or btn-sm on mobile
- Use min-w-11 min-h-11 utility classes

### Responsive Images

- Use ResponsiveImage component
- Formats: AVIF → WebP → PNG
- Sizes: 428w, 768w, 1440w
- Lazy load except LCP images

### Testing

- Playwright: Test at all mobile widths
- Touch targets: Assert ≥44px
- Horizontal scroll: Assert scrollWidth ≤ viewportWidth
- Visual regression: Baseline at mobile viewports
```

**Output**: ⏳ PENDING - Will be updated as part of task execution

---

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

### Task Generation Strategy

**Source Documents**:

1. Feature requirements from `spec.md` (27 FR + 13 NFR)
2. Design decisions from `research.md` (4 major areas)
3. Data model entities from `data-model.md` (6 entities)
4. Test scenarios from `quickstart.md` (5 scenarios)

**Task Categories**:

**1. Foundation Tasks** (Configuration & Setup):

- Update `tailwind.config.ts` with custom breakpoints
- Create `mobile-first-utilities.css` with utility classes
- Update `globals.css` with fluid typography
- Configure Playwright with mobile test viewports
- Create TypeScript configuration types

**2. Component Tasks** (Mobile-First Refactoring):

- Refactor GlobalNav for mobile-first navigation
- Update Button component with touch target standards
- Refactor Card component for responsive layouts
- Update Input components with mobile-friendly sizing
- Create ResponsiveImage component (5-file pattern)
- Create useDeviceType hook
- Create DeviceProvider context

**3. Page Tasks** (Layout Optimization):

- Refactor homepage layout for mobile-first
- Update blog list page layout
- Update blog post page layout
- Optimize docs page layout
- Fix footer layout for mobile

**4. Testing Tasks** (TDD Approach):

- Create mobile navigation tests
- Create touch target validation tests
- Create horizontal scroll detection tests
- Create typography tests
- Create orientation change tests
- Update existing blog-mobile-ux.spec.ts with 44px standards

**5. Image Optimization Tasks**:

- Create image optimization script
- Optimize existing blog images
- Update BlogPostCard to use ResponsiveImage
- Update AuthorProfile to use ResponsiveImage
- Configure service worker for AVIF caching

**6. Documentation Tasks**:

- Update CLAUDE.md with mobile-first guidelines
- Create MOBILE-FIRST-GUIDE.md
- Update component generator templates
- Document touch target standards in Storybook

### Ordering Strategy

**TDD Order**:

1. Write failing tests FIRST (RED)
2. Implement minimum code to pass (GREEN)
3. Refactor for quality (REFACTOR)

**Dependency Order**:

- Configuration → Components → Pages
- Tests → Implementation → Validation
- Foundation → Features → Polish

**Parallelization**:

- Mark independent tasks with [P] for parallel execution
- Configuration tasks can run in parallel
- Component updates can run in parallel (different files)
- Test creation can run in parallel with implementation

### Estimated Task Breakdown

**Phase 1: Foundation** (5-7 tasks)

- Tailwind configuration
- Utility classes
- TypeScript types
- Playwright configuration
- Baseline tests

**Phase 2: Core Components** (10-15 tasks)

- Navigation refactor
- Button standards
- Card layouts
- Form inputs
- Responsive images
- Device detection

**Phase 3: Pages** (8-10 tasks)

- Homepage
- Blog list
- Blog posts
- Docs
- Footer

**Phase 4: Testing** (8-12 tasks)

- Navigation tests
- Touch target tests
- Scroll tests
- Typography tests
- Orientation tests
- Visual regression

**Phase 5: Images** (5-7 tasks)

- Optimization script
- Image generation
- Component updates
- Service worker

**Phase 6: Documentation** (3-5 tasks)

- CLAUDE.md update
- Developer guide
- Template updates

**Total Estimated Tasks**: 52 numbered, ordered tasks

### Task Template

Each task will follow this format:

```markdown
### T###: [Task Name]

**Type**: [Configuration|Component|Page|Test|Image|Documentation]
**Priority**: [P0-Critical|P1-Important|P2-Nice-to-have]
**Depends On**: [T###, T###]
**Parallel**: [Yes/No]
**Estimated Time**: [15min|30min|1h|2h|4h]

**Acceptance Criteria**:

- [ ] Criterion 1
- [ ] Criterion 2

**Implementation Notes**:

- Note 1
- Note 2

**Testing**:

- Test command to validate
```

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

---

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD and constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

---

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation | Why Needed                          | Simpler Alternative Rejected Because |
| --------- | ----------------------------------- | ------------------------------------ |
| None      | All constitutional requirements met | N/A                                  |

**Justification**: This feature is a pure enhancement to existing codebase:

- Uses existing component structure (5-file pattern)
- Follows TDD methodology
- Implements via PRP workflow
- Uses Docker environment
- Enhances progressive enhancement (mobile-first)
- No new data collection (no privacy concerns)

---

## Progress Tracking

_This checklist is updated during execution flow_

### Phase Status

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

### Gate Status

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (6 items clarified in spec.md)
- [x] Complexity deviations documented (None - compliant)

### Artifact Status

- [x] `plan.md` created
- [x] `research.md` created (4 major research areas)
- [x] `data-model.md` created (6 entities defined)
- [x] `quickstart.md` created (30-min guide)
- [ ] `tasks.md` created (/tasks command)
- [ ] `contracts/` directory created (N/A for frontend-only feature)
- [ ] `CLAUDE.md` updated (pending task execution)

### Documentation Status

- [x] Feature specification complete (`spec.md`)
- [x] All clarifications resolved (Session 2025-10-01)
- [x] Research findings documented
- [x] Data model defined
- [x] Quickstart guide created
- [x] Implementation plan complete

---

## Ready for /tasks Command

**Status**: ✅ PLAN COMPLETE

**Next Action**: Execute `/tasks` command to generate `tasks.md` with 40-55 implementation tasks

**Branch**: `017-mobile-first-design`

**Artifacts Generated**:

1. ✅ `/specs/017-mobile-first-design/plan.md` (this file)
2. ✅ `/specs/017-mobile-first-design/research.md` (4 research areas)
3. ✅ `/specs/017-mobile-first-design/data-model.md` (6 entities)
4. ✅ `/specs/017-mobile-first-design/quickstart.md` (30-min guide)

**Pending**: 5. ⏳ `/specs/017-mobile-first-design/tasks.md` (will be created by /tasks)

---

_Based on Constitution v1.0.1 - See `.specify/memory/constitution.md`_
